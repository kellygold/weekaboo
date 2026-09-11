package app.weekaboo.calendar;

import android.app.Activity;
import android.net.Uri;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.microsoft.identity.client.*;
import com.microsoft.identity.client.exception.*;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Consumer;
import org.json.JSONObject;

/** MSAL owns token encryption/renewal and OAuth state/PKCE validation. */
final class MicrosoftAuthorization {
    interface Completion { void success(JSObject result); void failure(String code); }
    private final Activity activity;
    private IMultipleAccountPublicClientApplication application;
    MicrosoftAuthorization(Activity activity) { this.activity = activity; }

    private void withApplication(Completion completion, Consumer<IMultipleAccountPublicClientApplication> action) {
        if (application != null) { action.accept(application); return; }
        String clientId = activity.getString(R.string.microsoft_client_id);
        String hash = activity.getString(R.string.oauth_signature_hash);
        if (clientId.isEmpty() || hash.isEmpty()) { completion.failure("configuration"); return; }
        try {
            JSONObject config = new JSONObject();
            config.put("client_id", clientId);
            config.put("redirect_uri", "msauth://" + activity.getPackageName() + "/" + Uri.encode(hash));
            config.put("account_mode", "MULTIPLE");
            config.put("authorization_user_agent", "BROWSER");
            config.put("broker_redirect_uri_registered", false);
            config.put("logging", new JSONObject().put("pii_enabled", false).put("logcat_enabled", false).put("log_level", "ERROR"));
            config.put("authorities", new org.json.JSONArray().put(new JSONObject().put("type", "AAD").put("default", true).put("audience", new JSONObject().put("type", "AzureADandPersonalMicrosoftAccount"))));
            File file = new File(activity.getFilesDir(), "msal-public-config.json");
            try (FileOutputStream out = new FileOutputStream(file)) { out.write(config.toString().getBytes(StandardCharsets.UTF_8)); }
            PublicClientApplication.createMultipleAccountPublicClientApplication(activity, file, new IPublicClientApplication.IMultipleAccountApplicationCreatedListener() {
                @Override public void onCreated(IMultipleAccountPublicClientApplication app) { application = app; action.accept(app); }
                @Override public void onError(MsalException error) { completion.failure("configuration"); }
            });
        } catch (Exception ignored) { completion.failure("configuration"); }
    }

    void acquire(String ref, boolean interactive, boolean shared, boolean forceRefresh, Completion completion) {
        withApplication(completion, app -> {
            List<String> scopes = new ArrayList<>(Arrays.asList("User.Read", "Calendars.ReadWrite"));
            if (shared) scopes.add("Calendars.ReadWrite.Shared");
            String authority = "https://login.microsoftonline.com/" + (shared ? "organizations" : "common");
            AuthenticationCallback callback = new AuthenticationCallback() {
                @Override public void onSuccess(IAuthenticationResult result) {
                    IAccount account = result.getAccount();
                    if (ref != null && !ref.equals(account.getId())) { completion.failure("denied"); return; }
                    JSObject grant = new JSObject();
                    grant.put("accountRef", account.getId());
                    grant.put("accessToken", result.getAccessToken());
                    grant.put("scopes", new JSArray(Arrays.asList(result.getScope())));
                    java.text.SimpleDateFormat iso = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT);
                    iso.setTimeZone(TimeZone.getTimeZone("UTC"));
                    grant.put("expiresAt", iso.format(result.getExpiresOn()));
                    completion.success(grant);
                }
                @Override public void onError(MsalException error) { completion.failure(errorCode(error)); }
                @Override public void onCancel() { completion.failure("cancelled"); }
            };
            if (interactive && ref == null) {
                app.acquireToken(new AcquireTokenParameters.Builder().startAuthorizationFromActivity(activity).withScopes(scopes).fromAuthority(authority).withPrompt(Prompt.SELECT_ACCOUNT).withCallback(callback).build());
            } else {
                app.getAccount(ref, new IMultipleAccountPublicClientApplication.GetAccountCallback() {
                    @Override public void onTaskCompleted(IAccount account) {
                        if (account == null) { completion.failure("interaction-required"); return; }
                        if (interactive) app.acquireToken(new AcquireTokenParameters.Builder().startAuthorizationFromActivity(activity).withScopes(scopes).fromAuthority(authority).forAccount(account).withCallback(callback).build());
                        else app.acquireTokenSilentAsync(new AcquireTokenSilentParameters.Builder().forceRefresh(forceRefresh).withScopes(scopes).fromAuthority(authority).forAccount(account).withCallback(callback).build());
                    }
                    @Override public void onError(MsalException error) { completion.failure(errorCode(error)); }
                });
            }
        });
    }
    void forget(String ref, Completion completion) {
        withApplication(completion, app -> app.getAccount(ref, new IMultipleAccountPublicClientApplication.GetAccountCallback() {
            @Override public void onTaskCompleted(IAccount account) {
                if (account == null) { completion.success(new JSObject()); return; }
                app.removeAccount(account, new IMultipleAccountPublicClientApplication.RemoveAccountCallback() {
                    @Override public void onRemoved() { completion.success(new JSObject()); }
                    @Override public void onError(MsalException error) { completion.failure(errorCode(error)); }
                });
            }
            @Override public void onError(MsalException error) { completion.failure(errorCode(error)); }
        }));
    }
    private String errorCode(MsalException error) {
        if (error instanceof MsalUiRequiredException) return "interaction-required";
        if (error instanceof MsalClientException) return "unavailable";
        return "denied";
    }
}
