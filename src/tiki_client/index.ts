/*
 * Copyright (c) TIKI Inc.
 * MIT license. See LICENSE file in root directory.
 */

import Capture from "../capture";
import Auth from "../auth";
import License from "../license";
import KeyService from "../key";
import Utils from "../utils";
import type {
  RspGuard,
  PostLicenseRequest,
} from "../license/types/index";
import { Config } from "../config";
import { App } from "@capacitor/app";
import { ReceiptResponse } from "../capture/types";

/**
 * TikiClient is the main interface for interacting with the TIKI services.
 * 
 * This class provides methods for authentication, capturing images, licensing, 
 * and publishing data to the TIKI Data Cloud.
 * 
 * It operates as a singleton, ensuring one instance across the application once initialized.
 * 
 * Besides this high-level API, internal APIs are available for more customized implementations:
 * - TikiClient.auth: handles the authentication with TIKI.
 * - TikiClient.capture: provides methods to capture receipt data.
 * - TikiClient.license: manages the data licensing.
 */
export default class TikiClient {
  private static instance: TikiClient;

  private userId: string | undefined;
  private config: Config | undefined;
  private keyService = new KeyService();

  private constructor() { }

  public auth: Auth = new Auth(this.keyService);
  public capture = new Capture();
  public license = new License();

  /**
   * Get the singleton instance of TikiClient.
   *
   * @returns TikiClient
   */
  public static getInstance(): TikiClient {
    if (!TikiClient.instance) {
      TikiClient.instance = new TikiClient();
    }
    return TikiClient.instance;
  }

  /**
   * Initialize the TikiClient and register the device's address.
   * @param {string} userId - the ID to be registered to identify the user.
   */
  public static async initialize(userId: string): Promise<void> {
    let instance = TikiClient.getInstance();

    if (instance.config == undefined) {
      console.error(
        "TIKI Client is not configured. Use the TikiClient.configure method to add a configuration."
      );
      return;
    }

    const key = await instance.keyService.get(
      instance.config.providerId,
      userId
    );
    if (!key) {
      await instance.auth.registerAddress(
        instance.config.providerId,
        instance.config.publicKey,
        userId
      );
    }

    instance.userId = userId;

    await instance.saveToken()
  }

  /**
   * Uses the capacitor camera plugin to take a picture
   * @returns {string | void} - The base64 string of the image or void in case of any error.
   */
  public static async scan(): Promise<string | void> {
    let instance = TikiClient.getInstance();

    if (instance.config == undefined) {
      console.error(
        "TIKI Client is not configured. Use the TikiClient.configure method to add a configuration."
      );
      return;
    }

    return await instance.capture.scan()
  }
  
  /**
   * Publish an amount of picture to Tiki Back-end
   * @param {string[]} images - Receives an array of base64 string of the images which need to be published to Tiki
   * @returns {Promise<string | void>} - A promise with the request Id of the upload operation or void in case of any error.
   */
  public static async publish(images: string[]): Promise<string | void> {
    let instance = TikiClient.getInstance();

    if (instance.config == undefined) {
      console.error(
        "TIKI Client is not configured. Use the TikiClient.configure method to add a configuration."
      );
      return;
    }

    if (instance.userId == undefined) {
      console.error(
        "User id not defined. Use the TikiClient.initialize method to register the user."
      );
      return;
    }

    const verifyLicense: RspGuard = await instance.license.verify(
    );

    if (!verifyLicense || !verifyLicense.verified) {
      console.error(
        "The License is invalid. Use the TikiClient.license method to issue a new License."
      );
      return;
    }

    return await instance.capture.publish(images);
  }

  /**
   * Create a license to publish data to Tiki
   * @returns {Promise<PostLicenseRequest | void>} - The object that contains the license information or void in case of any error.
   */
  public static async createLicense(): Promise<PostLicenseRequest | void> {
    let instance = TikiClient.getInstance();

    if (instance.config == undefined) {
      console.error(
        "TIKI Client is not configured. Use the TikiClient.configure method to add a configuration."
      );
      return;
    }

    if (instance.userId == undefined) {
      console.error(
        "User id not defined. Use the TikiClient.initialize method to register the user."
      );
      return;
    }

    const key = await instance.keyService.get(
      instance.config.providerId,
      instance.userId
    );

    if (!key) {
      console.error(
        "Key Pair not found. Use the TikiClient.initialize method to register the user."
      );
      return;
    }

    const terms: string = instance.license.terms(
      instance.config.companyName,
      instance.config.companyJurisdiction,
      instance.config.tosUrl,
      instance.config.privacyUrl
    )

    const appId = (await App.getInfo()).id;

    let licenseReq: PostLicenseRequest = {
      ptr: instance.userId,
      tags: ["purchase_history"],
      uses: [
        {
          usecases: ["attribution"],
          destinations: ["*"],
        },
      ],
      description: "",
      origin: appId,
      expiry: undefined,
      terms: terms
    };

    const licenseSignature = await Utils.signMessage(
      JSON.stringify(licenseReq),
      key.value.privateKey
    );

    licenseReq.signature = licenseSignature

    return await instance.license.create(licenseReq);
  }

  /**
   * Configure the class instance with the company information, necessary to others operations
   * @param {Config} configuration - The Object that contains the company information to be instantiated.
   */
  public static configuration(configuration: Config) {
    let instance = TikiClient.getInstance();
    instance.config = configuration;
  }

  /**
   * Retrieve the structured data extracted from the processed receipt image.
   * 
   * This method fetches the result of the receipt image processing from the server.
   * 
   * @param {string} receiptId - The unique identifier for the receipt obtained from the {@link publish} method.
   * @returns {Promise<ReceiptResponse[] | undefined>} A Promise that resolves with an array of {@link ReceiptResponse} objects,
   * each containing the structured data extracted from an image of the receipt, or undefined if the retrieval fails.
   */
  public static async receipt(receiptId: string): Promise<ReceiptResponse[] | undefined>{
    let instance = TikiClient.getInstance();

    if (instance.config == undefined) {
      console.error(
        "TIKI Client is not configured. Use the TikiClient.configure method to add a configuration."
      );
      return;
    }

    if (instance.userId == undefined) {
      console.error(
        "User id not defined. Use the TikiClient.initialize method to register the user."
      );
      return;
    }

    const receipt = await instance.capture.receipt(receiptId);

    return receipt;
  }

  public static logout(){
    let instance = TikiClient.getInstance();

    if (instance.config == undefined) {
      console.error(
        "TIKI Client is not configured. Use the TikiClient.configure method to add a configuration."
      );
      return;
    }

    if (instance.userId == undefined) {
      console.error(
        "No user logged in"
      );
      return;
    }

    return instance.auth.logout()
  }

  private async saveToken(){
    let instance = TikiClient.getInstance();

    if (instance.config == undefined) {
      console.error(
        "TIKI Client is not configured. Use the TikiClient.configure method to add a configuration."
      );
      return;
    }

    const key = await instance.keyService.get(
      instance.config.providerId,
      instance.userId!
    );

    if (!key) {
      console.error(
        "Key Pair not found. Use the TikiClient.initialize method to register the user."
      );
      return;
    }

    const address: string = Utils.arrayBufferToBase64Url(
      await instance.keyService.address(key.value)
    );

    const signature: string = await Utils.generateSignature(
      address,
      key?.value.privateKey
    );

    const addressToken = await instance.auth.getToken(
      instance?.config!.providerId,
      signature,
      ["trail publish"],
      address
    );

    if (!addressToken || !addressToken.token) {
      console.error("Failed to get Address Token");
      return;
    }
  }

}
