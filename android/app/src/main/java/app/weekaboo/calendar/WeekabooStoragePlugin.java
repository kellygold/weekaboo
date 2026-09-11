package app.weekaboo.calendar;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** Narrow storage bridge. Task rules and provider behavior remain in TypeScript. */
@CapacitorPlugin(name = "WeekabooStorage")
public class WeekabooStoragePlugin extends Plugin {
    private Database database;
    private static final String KEY = "weekaboo.credentials.v1";
    @Override public void load() { database = new Database(getContext()); }
    private static class Database extends SQLiteOpenHelper {
        Database(Context context) { super(context, "weekaboo-local.db", null, 2); }
        @Override public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE task_snapshot (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL)");
            db.execSQL("INSERT INTO task_snapshot VALUES(1, 0, '[]')");
            createDocuments(db);
        }
        @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
            if (oldVersion == 1 && newVersion == 2) createDocuments(db);
            else throw new IllegalStateException("Unsupported database upgrade");
        }
    }
    private static void createDocuments(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE documents (key TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL)");
    }
    @PluginMethod public void readDocument(PluginCall call) {
        String key = call.getString("key");
        if (key == null || !key.matches("[a-z][a-z0-9-]{0,63}")) { call.reject("Invalid document key.", "validation"); return; }
        try (Cursor cursor = database.getReadableDatabase().rawQuery("SELECT revision, body FROM documents WHERE key=?", new String[]{key})) {
            JSObject result = new JSObject();
            if (cursor.moveToFirst()) { result.put("revision", cursor.getLong(0)); result.put("value", cursor.getString(1)); }
            else { result.put("revision", 0); result.put("value", JSONObject.NULL); }
            call.resolve(result);
        } catch (Exception ignored) { call.reject("Local document could not be read.", "storage"); }
    }
    @PluginMethod public void writeDocument(PluginCall call) {
        String key = call.getString("key"), body = call.getString("value");
        Object raw = call.getData().opt("revision");
        Number number = raw instanceof Number ? (Number) raw : null;
        long revision = number == null ? -1 : number.longValue();
        if (key == null || !key.matches("[a-z][a-z0-9-]{0,63}") || body == null || body.length() > 8000000 || revision < 0 || revision >= 9007199254740991L || number.doubleValue() != (double) revision) { call.reject("Invalid document.", "validation"); return; }
        try {
            SQLiteDatabase db = database.getWritableDatabase();
            boolean committed;
            db.beginTransaction();
            try {
                ContentValues values = new ContentValues(); values.put("key", key); values.put("revision", revision + 1); values.put("body", body);
                if (revision == 0) committed = db.insertWithOnConflict("documents", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1;
                else committed = db.update("documents", values, "key=? AND revision=?", new String[]{key, Long.toString(revision)}) == 1;
                db.setTransactionSuccessful();
            } finally { db.endTransaction(); }
            JSObject result = new JSObject(); result.put("committed", committed); call.resolve(result);
        } catch (Exception ignored) { call.reject("Local document could not be saved.", "storage"); }
    }
    @PluginMethod public void readTasks(PluginCall call) {
        try (Cursor cursor = database.getReadableDatabase().rawQuery("SELECT revision, body FROM task_snapshot WHERE id=1", null)) {
            if (!cursor.moveToFirst()) throw new IllegalStateException();
            JSObject result = new JSObject(); result.put("revision", cursor.getLong(0)); result.put("tasks", new JSArray(cursor.getString(1))); call.resolve(result);
        } catch (Exception e) { call.reject("Task storage could not be read.", "storage"); }
    }
    @PluginMethod public void writeTasks(PluginCall call) {
        Object revisionValue = call.getData().opt("revision");
        Number number = revisionValue instanceof Number ? (Number) revisionValue : null;
        Long revision = number == null ? null : number.longValue();
        JSArray tasks = call.getArray("tasks");
        if (revision == null || revision < 0 || revision >= 9007199254740991L || number.doubleValue() != revision.doubleValue() || tasks == null) { call.reject("Invalid task snapshot.", "validation"); return; }
        try {
            SQLiteDatabase db = database.getWritableDatabase();
            boolean committed;
            db.beginTransaction();
            try {
                ContentValues values = new ContentValues(); values.put("revision", revision + 1); values.put("body", tasks.toString());
                committed = db.update("task_snapshot", values, "id=1 AND revision=?", new String[]{Long.toString(revision)}) == 1;
                db.setTransactionSuccessful();
            } finally { db.endTransaction(); }
            // Acknowledge only after SQLite successfully commits.
            JSObject result = new JSObject(); result.put("committed", committed); call.resolve(result);
        } catch (Exception e) { call.reject("Task storage could not be saved.", "storage"); }
    }
    private String reference(PluginCall call) {
        String ref = call.getString("reference");
        if (ref == null || !ref.matches("[A-Za-z0-9._:-]{1,200}")) throw new IllegalArgumentException();
        return ref;
    }
    private synchronized SecretKey key(boolean create) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(KEY)) {
            if (!create) throw new IllegalStateException("Key unavailable");
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(KEY, null);
    }
    @PluginMethod public void vaultPut(PluginCall call) {
        try {
            String ref = reference(call), value = call.getString("value"); if (value == null) throw new IllegalArgumentException();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key(true));
            cipher.updateAAD(ref.getBytes(StandardCharsets.UTF_8));
            String record = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!getContext().getSharedPreferences("weekaboo-vault", Context.MODE_PRIVATE).edit().putString(ref, record).commit()) throw new IllegalStateException();
            call.resolve();
        } catch (Exception e) { call.reject("Credential could not be stored securely.", "vault"); }
    }
    @PluginMethod public void vaultGet(PluginCall call) {
        try {
            String ref = reference(call), record = getContext().getSharedPreferences("weekaboo-vault", Context.MODE_PRIVATE).getString(ref, null);
            JSObject result = new JSObject();
            if (record == null) { result.put("value", JSONObject.NULL); call.resolve(result); return; }
            String[] parts = record.split(":", 2); Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            cipher.updateAAD(ref.getBytes(StandardCharsets.UTF_8));
            result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8)); call.resolve(result);
        } catch (Exception e) { call.reject("Credential unavailable. Reconnect this account.", "vault"); }
    }
    @PluginMethod public void vaultRemove(PluginCall call) {
        try {
            if (!getContext().getSharedPreferences("weekaboo-vault", Context.MODE_PRIVATE).edit().remove(reference(call)).commit()) throw new IllegalStateException();
            call.resolve();
        } catch (Exception e) { call.reject("Credential could not be removed.", "vault"); }
    }
}
