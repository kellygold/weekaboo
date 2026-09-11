import Foundation

public struct NativeHTTPResponse {
    public let status: Int
    public let headers: [String: String]
    public let body: String
}
public enum NativeHTTP {
    public static func request(url: String, method: String, headers: [String: String], body: String?, timeout: Double, completion: @escaping (Result<NativeHTTPResponse, Error>) -> Void) {
        guard let address = URL(string: url), address.scheme == "https", address.host != nil, address.user == nil, address.password == nil,
              ["GET", "POST", "PATCH", "PUT", "DELETE", "PROPFIND", "REPORT"].contains(method),
              // Swift treats CRLF as one grapheme; String.contains("\r") and
              // contains("\n") both miss that pair. Validate the actual bytes.
              headers.allSatisfy({ !$0.key.utf8.contains(13) && !$0.key.utf8.contains(10) && !$0.value.utf8.contains(13) && !$0.value.utf8.contains(10) }),
              (body?.utf8.count ?? 0) <= 16_777_216 else { completion(.failure(NativeFailure.validation)); return }
        var request = URLRequest(url: address, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: min(120, max(1, timeout)))
        request.httpMethod = method; request.httpBody = body?.data(using: .utf8)
        for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForResource = min(120, max(1, timeout))
        configuration.httpShouldSetCookies = false; configuration.httpCookieStorage = nil
        configuration.urlCredentialStorage = nil; configuration.urlCache = nil
        let delegate = BoundedResponse(completion: completion)
        let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
        delegate.session = session
        session.dataTask(with: request).resume()
    }
}
private final class BoundedResponse: NSObject, URLSessionDataDelegate {
    private let completion: (Result<NativeHTTPResponse, Error>) -> Void
    var session: URLSession?
    private var bytes = Data()
    private var response: HTTPURLResponse?
    private var finished = false
    private let limit = 16_777_216
    init(completion: @escaping (Result<NativeHTTPResponse, Error>) -> Void) { self.completion = completion }
    private func finish(_ result: Result<NativeHTTPResponse, Error>) {
        guard !finished else { return }; finished = true
        completion(result); session?.invalidateAndCancel(); session = nil
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        // Shared provider code validates each redirect BEFORE attaching secrets.
        completionHandler(nil)
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        guard let response = response as? HTTPURLResponse else { completionHandler(.cancel); finish(.failure(NativeFailure.unavailable)); return }
        guard response.expectedContentLength <= Int64(limit) else { completionHandler(.cancel); finish(.failure(NativeFailure.oversized)); return }
        self.response = response; completionHandler(.allow)
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard bytes.count <= limit - data.count else { finish(.failure(NativeFailure.oversized)); return }
        bytes.append(data)
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard error == nil, let response = response, let body = String(data: bytes, encoding: .utf8) else { finish(.failure(NativeFailure.unavailable)); return }
        var headers: [String: String] = [:]
        for (key, value) in response.allHeaderFields { if let name = key as? String { headers[name.lowercased()] = String(describing: value) } }
        finish(.success(NativeHTTPResponse(status: response.statusCode, headers: headers, body: body)))
    }
}
