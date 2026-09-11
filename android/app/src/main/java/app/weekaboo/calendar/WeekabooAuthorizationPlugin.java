package app.weekaboo.calendar;

import android.accounts.Account;
import android.app.Activity;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Scope;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Native SDK credentials stay behind the runtime port; no web client secret or local server. */
@CapacitorPlugin(name = "WeekabooAuthorization")
public class WeekabooAuthorizationPlugin extends Plugin {
    private final AtomicBoolean busy = new AtomicBoolean();
    private PluginCall pendingGoogle;
    private ActivityResultLauncher<IntentSenderRequest> googleResolution;
    private MicrosoftAuthorization microsoft;

    @Override public void load() {
        microsoft = new MicrosoftAuthorization(getActivity());
        googleResolution = bridge.registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), result -> {
            PluginCall call = pendingGoogle;
            pendingGoogle = null;
            // A process restart drops the old JS caller. Never broadcast a token as a restored event.
            if (call == null) { busy.set(false); return; }
            if (result.getResultCode() != Activity.RESULT_OK) { reject(call, "cancelled"); return; }
            try { finishGoogle(call, Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(result.getData())); }
            catch (Exception error) { googleError(call, error); }
        });
    }

    @PluginMethod public void setup(PluginCall call) {
        try {
            byte[] digest = signingDigest();
            String hash = Base64.encodeToString(digest, Base64.NO_WRAP);
            StringBuilder sha1 = new StringBuilder();
            for (byte b : digest) { if (sha1.length() > 0) sha1.append(':'); sha1.append(String.format(Locale.ROOT, "%02X", b)); }
            JSObject value = new JSObject();
            value.put("googleAvailable", GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext()) == ConnectionResult.SUCCESS);
            value.put("microsoftConfigured", !getContext().getString(R.string.microsoft_client_id).isEmpty() && hash.equals(getContext().getString(R.string.oauth_signature_hash)));
            value.put("packageName", getContext().getPackageName());
            value.put("sha1", sha1.toString()); value.put("signatureHash", hash);
            value.put("microsoftRedirectUri", "msauth://" + getContext().getPackageName() + "/" + Uri.encode(hash));
            call.resolve(value);
        } catch (Exception ignored) { call.reject("Cannot read this installation's public signing identity.", "configuration"); }
    }

    @SuppressWarnings("deprecation") private byte[] signingDigest() throws Exception {
        PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNATURES);
        if (info.signatures == null || info.signatures.length != 1) throw new IllegalStateException();
        return MessageDigest.getInstance("SHA-1").digest(info.signatures[0].toByteArray());
    }

    @PluginMethod public void acquire(PluginCall call) {
        String provider = call.getString("provider");
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        String ref = call.getString("accountRef");
        if ((!"google".equals(provider) && !"microsoft".equals(provider)) || (!interactive && (ref == null || ref.isEmpty()))) {
            call.reject("An existing account is required for silent authorization.", "configuration"); return;
        }
        if (!busy.compareAndSet(false, true)) { call.reject("Authorization already in progress.", "busy"); return; }
        getActivity().runOnUiThread(() -> {
            try {
                if ("google".equals(provider)) {
                    String rejected = call.getString("rejectedAccessToken");
                    if (rejected != null && !rejected.isEmpty()) Identity.getAuthorizationClient(getActivity())
                        .clearToken(ClearTokenRequest.builder().setToken(rejected).build())
                        .addOnSuccessListener(ignored -> authorizeGoogle(call, ref, interactive))
                        .addOnFailureListener(error -> googleError(call, error));
                    else authorizeGoogle(call, ref, interactive);
                }
                else {
                    String hash = Base64.encodeToString(signingDigest(), Base64.NO_WRAP);
                    if (!hash.equals(getContext().getString(R.string.oauth_signature_hash))) { reject(call, "configuration"); return; }
                    microsoft.acquire(ref, interactive, Boolean.TRUE.equals(call.getBoolean("sharedWorkCalendars", false)), call.getString("rejectedAccessToken") != null, callback(call));
                }
            } catch (Exception ignored) { reject(call, "configuration"); }
        });
    }

    private void authorizeGoogle(PluginCall call, String ref, boolean interactive) {
        if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext()) != ConnectionResult.SUCCESS) { reject(call, "unavailable"); return; }
        List<Scope> scopes = Arrays.asList(new Scope("https://www.googleapis.com/auth/calendar"), new Scope("https://www.googleapis.com/auth/userinfo.email"), new Scope("openid"));
        AuthorizationRequest.Builder builder = AuthorizationRequest.builder().setRequestedScopes(scopes);
        if (ref != null && !ref.isEmpty()) builder.setAccount(new Account(ref, "com.google"));
        else builder.setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT);
        Identity.getAuthorizationClient(getActivity()).authorize(builder.build())
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    if (!interactive) { reject(call, "interaction-required"); return; }
                    pendingGoogle = call;
                    try { googleResolution.launch(new IntentSenderRequest.Builder(result.getPendingIntent().getIntentSender()).build()); }
                    catch (Exception ignored) { pendingGoogle = null; reject(call, "unavailable"); }
                } else finishGoogle(call, result);
            }).addOnFailureListener(error -> googleError(call, error));
    }

    private void finishGoogle(PluginCall call, AuthorizationResult result) {
        if (result.getAccessToken() == null || !result.getGrantedScopes().contains("https://www.googleapis.com/auth/calendar")) { reject(call, "denied"); return; }
        JSObject grant = new JSObject();
        grant.put("accessToken", result.getAccessToken());
        grant.put("scopes", new JSArray(result.getGrantedScopes()));
        // AuthorizationResult has no account identity. The shared provider validates userinfo
        // before persisting the account or using a token obtained for an existing account.
        busy.set(false); call.resolve(grant);
    }
    private void googleError(PluginCall call, Exception error) {
        String code = "unavailable";
        if (error instanceof ApiException) {
            int status = ((ApiException) error).getStatusCode();
            if (status == CommonStatusCodes.CANCELED) code = "cancelled";
            else if (status == CommonStatusCodes.DEVELOPER_ERROR) code = "configuration";
            else if (status == CommonStatusCodes.SIGN_IN_REQUIRED) code = "interaction-required";
        }
        reject(call, code);
    }

    @PluginMethod public void forget(PluginCall call) {
        String provider = call.getString("provider"), ref = call.getString("accountRef");
        if (ref == null || ref.isEmpty() || (!"google".equals(provider) && !"microsoft".equals(provider))) { call.reject("Invalid account reference.", "configuration"); return; }
        if (!busy.compareAndSet(false, true)) { call.reject("Authorization already in progress.", "busy"); return; }
        // Google SDK owns per-device grants. Disconnect removes our metadata; do not revoke
        // every scope in the Cloud project (it can also be used by the existing browser app).
        if ("google".equals(provider)) { busy.set(false); call.resolve(); return; }
        getActivity().runOnUiThread(() -> microsoft.forget(ref, callback(call)));
    }
    private MicrosoftAuthorization.Completion callback(PluginCall call) {
        return new MicrosoftAuthorization.Completion() {
            public void success(JSObject result) { busy.set(false); call.resolve(result); }
            public void failure(String code) { reject(call, code); }
        };
    }
    private void reject(PluginCall call, String code) { busy.set(false); call.reject("Authorization could not complete.", code); }
    @Override protected void handleOnDestroy() {
        if (pendingGoogle != null) { reject(pendingGoogle, "cancelled"); pendingGoogle = null; }
        super.handleOnDestroy();
    }
}
