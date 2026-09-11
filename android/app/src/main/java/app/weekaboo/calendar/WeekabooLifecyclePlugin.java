package app.weekaboo.calendar;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name = "WeekabooLifecycle")
public class WeekabooLifecyclePlugin extends Plugin {
    private void activity(boolean active) { JSObject event = new JSObject(); event.put("active", active); notifyListeners("activity", event); }
    @Override protected void handleOnResume() { activity(true); }
    @Override protected void handleOnPause() { activity(false); }
}
