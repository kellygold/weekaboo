package app.weekaboo.calendar;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WeekabooStoragePlugin.class);
        registerPlugin(WeekabooFilesPlugin.class);
        registerPlugin(WeekabooLifecyclePlugin.class);
        registerPlugin(WeekabooHttpPlugin.class);
        registerPlugin(WeekabooAuthorizationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
