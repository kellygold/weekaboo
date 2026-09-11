package app.weekaboo.calendar;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** System document picker: no broad filesystem permission and no arbitrary path access. */
@CapacitorPlugin(name = "WeekabooFiles")
public class WeekabooFilesPlugin extends Plugin {
    private static final int LIMIT = 4000000;
    private final AtomicBoolean busy = new AtomicBoolean();
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private ActivityResultLauncher<Intent> picker;
    private PluginCall pending;
    private byte[] contents;
    @Override public void load() {
        picker = bridge.registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            PluginCall call = pending; byte[] bytes = contents; pending = null; contents = null;
            // A killed process has no live JS recipient; never restore file content as an event.
            if (call == null) { busy.set(false); return; }
            Uri uri = result.getData() == null ? null : result.getData().getData();
            if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
                JSObject response = new JSObject(); response.put(bytes == null ? "contents" : "saved", bytes == null ? org.json.JSONObject.NULL : false);
                busy.set(false); call.resolve(response); return;
            }
            worker.execute(() -> {
                try {
                    JSObject response = new JSObject();
                    if (bytes == null) {
                        try (InputStream input = getContext().getContentResolver().openInputStream(uri); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                            if (input == null) throw new IOException();
                            byte[] buffer = new byte[8192]; int size;
                            while ((size = input.read(buffer)) != -1) { if (output.size() + size > LIMIT) throw new IOException(); output.write(buffer, 0, size); }
                            String value = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(output.toByteArray())).toString();
                            response.put("contents", value);
                        }
                    } else {
                        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                            if (output == null) throw new IOException(); output.write(bytes); output.flush();
                        }
                        response.put("saved", true);
                    }
                    call.resolve(response);
                } catch (Exception ignored) { call.reject("The task backup could not be opened or saved. Choose a JSON backup smaller than 4 MB and try again.", "unavailable"); }
                finally { busy.set(false); }
            });
        });
    }
    @PluginMethod public void pick(PluginCall call) { launch(call, null, null); }
    @PluginMethod public void save(PluginCall call) {
        String name = call.getString("name"), text = call.getString("contents");
        if (name == null || !name.matches("weekaboo-tasks-[0-9-]+\\.json") || text == null || text.getBytes(StandardCharsets.UTF_8).length > LIMIT) {
            call.reject("Invalid task backup.", "validation"); return;
        }
        launch(call, name, text.getBytes(StandardCharsets.UTF_8));
    }
    private void launch(PluginCall call, String name, byte[] bytes) {
        if (!busy.compareAndSet(false, true)) { call.reject("A file picker is already open.", "busy"); return; }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(bytes == null ? Intent.ACTION_OPEN_DOCUMENT : Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/json");
                if (name != null) intent.putExtra(Intent.EXTRA_TITLE, name);
                pending = call; contents = bytes; picker.launch(intent);
            } catch (Exception ignored) { pending = null; contents = null; busy.set(false); call.reject("The file picker could not be opened.", "unavailable"); }
        });
    }
    @Override protected void handleOnDestroy() { worker.shutdown(); }
}
