import Utils from "../utils";

export default class License {
  private baseUrl: string =
    "https://corsproxy.io/?" + encodeURIComponent("https://postman-echo.com");
  private utils = new Utils();

  public async create(
    token: string,
    postLicenseRequest: PostLicenseRequest
  ): Promise<PostLicenseRequest> {
    const url = `${this.baseUrl}/${"post"}`
    return this.utils.handleRequest<PostLicenseRequest>(
      url,
      "POST",
      token,
      postLicenseRequest
    )
  }

  public async get(id: string, token: string): Promise<RspLicenses> {
    const url = `${this.baseUrl}/${"get"}?id=${id}`
    return this.utils.handleRequest<RspLicenses>(url, "GET", token)
  }

  public async guard(
    postGuardRequest: PostGuardRequest,
    token: string
  ): Promise<RspGuard> {
    const url = `${this.baseUrl}/post`
    return this.utils.handleRequest<RspGuard>(
      url,
      "POST",
      token,
      postGuardRequest
    )
  }
}