package app.weekaboo.calendar;

import android.graphics.Rect;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.microsoft.identity.common.internal.ui.DualScreenActivity;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.lang.reflect.Method;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Tests the actual MSAL activity on ART without the legacy throwing SDK stub. */
@RunWith(AndroidJUnit4.class)
public class MicrosoftDisplayFallbackTest {
    @Test public void absentDisplayMaskFallsBackWithoutCrashing() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertFalse(context.getPackageManager().hasSystemFeature("com.microsoft.device.display.displaymask"));
        try {
            Class.forName("com.microsoft.device.display.DisplayMask", false, context.getClassLoader());
            fail("The unused Surface Duo compile stub must not be bundled");
        } catch (ClassNotFoundException expected) { }

        AtomicReference<Throwable> failure = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                DualScreenActivity activity = new DualScreenActivity();
                // Call even on a single-screen device to exercise MSAL's missing-class catch.
                Method query = DualScreenActivity.class.getDeclaredMethod("getHinge", Context.class, int.class);
                query.setAccessible(true);
                assertEquals(new Rect(0, 0, 0, 0), query.invoke(activity, context, 0));
            } catch (Throwable error) { failure.set(error); }
        });
        if (failure.get() != null) throw new AssertionError("MSAL hinge fallback failed", failure.get());
    }
}
