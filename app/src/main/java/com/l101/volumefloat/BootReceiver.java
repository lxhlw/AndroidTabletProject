package com.l101.volumefloat;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {

        String action = intent != null ? intent.getAction() : null;

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || VolumeFloatService.ACTION_WATCHDOG.equals(action)
                || VolumeFloatService.ACTION_RESTART_AFTER_TASK_REMOVED.equals(action)) {

            Intent service =
                    new Intent(context, VolumeFloatService.class);

            context.startService(service);

            VolumeFloatService.scheduleWatchdog(context);
        }
    }
}
