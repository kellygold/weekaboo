package app.weekaboo.calendar;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.Iterator;
import java.util.Locale;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/** CalDAV requires methods Android's URLConnection implementation rejects. */
@CapacitorPlugin(name = "WeekabooHttp")
public class WeekabooHttpPlugin extends Plugin {
    private final OkHttpClient client = new OkHttpClient.Builder()
        .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build();
    @PluginMethod public void request(PluginCall call) {
        try {
            HttpUrl url = HttpUrl.get(call.getString("url", ""));
            if (!url.isHttps() || !url.username().isEmpty() || !url.password().isEmpty()) throw new IllegalArgumentException();
            String method = call.getString("method", "GET").toUpperCase(Locale.ROOT);
            if (!Arrays.asList("GET", "POST", "PATCH", "PUT", "DELETE", "PROPFIND", "REPORT").contains(method)) throw new IllegalArgumentException();
            JSObject headers = call.getObject("headers", new JSObject());
            Request.Builder builder = new Request.Builder().url(url);
            for (Iterator<String> keys = headers.keys(); keys.hasNext();) {
                String name = keys.next(); builder.header(name, headers.getString(name));
            }
            String data = call.getString("body");
            boolean requiresBody = Arrays.asList("POST", "PUT", "PATCH", "PROPFIND", "REPORT").contains(method);
            RequestBody body = data != null || requiresBody ? RequestBody.create(data == null ? "" : data, (MediaType) null) : null;
            if (method.equals("GET") && body != null) throw new IllegalArgumentException();
            builder.method(method, body);
            int timeout = Math.max(1000, Math.min(120000, call.getInt("timeoutMs", 15000)));
            client.newBuilder().callTimeout(timeout, TimeUnit.MILLISECONDS).build().newCall(builder.build()).enqueue(new Callback() {
                @Override public void onFailure(Call request, IOException error) {
                    // Do not include URLs, headers or bodies in diagnostics.
                    call.reject("Provider request could not be confirmed.", "network");
                }
                @Override public void onResponse(Call request, Response response) {
                    try (response) {
                        JSObject result = new JSObject(), responseHeaders = new JSObject();
                        for (String name : response.headers().names()) responseHeaders.put(name.toLowerCase(Locale.ROOT), response.header(name));
                        result.put("status", response.code()); result.put("headers", responseHeaders);
                        if (response.body() != null && (response.body().contentLength() > 16777216 || response.body().source().request(16777217))) throw new IOException("Response exceeds local limit");
                        result.put("body", response.body() == null ? "" : response.body().string()); call.resolve(result);
                    } catch (Exception error) { call.reject("Provider response could not be read.", "network"); }
                }
            });
        } catch (Exception error) { call.reject("Invalid HTTPS provider request.", "validation"); }
    }
}
