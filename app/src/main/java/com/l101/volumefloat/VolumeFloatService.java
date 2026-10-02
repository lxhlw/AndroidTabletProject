package com.l101.volumefloat;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.media.AudioManager;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;

public class VolumeFloatService extends Service {

    private WindowManager windowManager;
    private LinearLayout panel;
    private AudioManager audio;
    private WindowManager.LayoutParams params;

    // 拖动相关
    private float downRawX;
    private float downRawY;
    private int downX;
    private int downY;
    private boolean moved;

    @Override
    public void onCreate() {
        super.onCreate();

        audio = (AudioManager) getSystemService(AUDIO_SERVICE);

        createFloatButton();
    }

    private void createFloatButton() {

        windowManager =
                (WindowManager) getSystemService(WINDOW_SERVICE);

        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setBackgroundColor(Color.argb(160, 0, 0, 0));

        Button plus = new Button(this);
        plus.setText("+");

        Button minus = new Button(this);
        minus.setText("-");

        panel.addView(
                plus,
                new LinearLayout.LayoutParams(90, 80)
        );

        panel.addView(
                minus,
                new LinearLayout.LayoutParams(90, 80)
        );

        // + 按钮：使用系统默认音量流
        plus.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {

                audio.adjustSuggestedStreamVolume(
                        AudioManager.ADJUST_RAISE,
                        AudioManager.USE_DEFAULT_STREAM_TYPE,
                        AudioManager.FLAG_SHOW_UI
                );
            }
        });

        // - 按钮：使用系统默认音量流
        minus.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {

                audio.adjustSuggestedStreamVolume(
                        AudioManager.ADJUST_LOWER,
                        AudioManager.USE_DEFAULT_STREAM_TYPE,
                        AudioManager.FLAG_SHOW_UI
                );
            }
        });

        params = new WindowManager.LayoutParams();

        params.width = 100;
        params.height = 170;

        params.gravity =
                Gravity.RIGHT |
                Gravity.CENTER_VERTICAL;

        params.format =
                PixelFormat.TRANSLUCENT;

        params.type =
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;

        params.flags =
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;

        /*
         * 拖动逻辑：
         * 轻点 = 点击
         * 按住移动 = 拖动悬浮窗
         */
        View.OnTouchListener dragListener =
                new View.OnTouchListener() {

                    @Override
                    public boolean onTouch(
                            View v,
                            MotionEvent event) {

                        switch (event.getAction()) {

                            case MotionEvent.ACTION_DOWN:

                                downRawX = event.getRawX();
                                downRawY = event.getRawY();

                                downX = params.x;
                                downY = params.y;

                                moved = false;

                                return true;

                            case MotionEvent.ACTION_MOVE:

                                float dx =
                                        event.getRawX()
                                        - downRawX;

                                float dy =
                                        event.getRawY()
                                        - downRawY;

                                if (Math.abs(dx) > 5 ||
                                    Math.abs(dy) > 5) {

                                    moved = true;
                                }

                                if (moved) {

                                    /*
                                     * 使用 Gravity.RIGHT：
                                     * 向右拖动 -> x 减小
                                     * 向左拖动 -> x 增大
                                     */

                                    params.x =
                                            downX - (int) dx;

                                    params.y =
                                            downY + (int) dy;

                                    windowManager.updateViewLayout(
                                            panel,
                                            params
                                    );
                                }

                                return true;

                            case MotionEvent.ACTION_UP:

                                if (!moved) {
                                    v.performClick();
                                }

                                return true;

                            case MotionEvent.ACTION_CANCEL:

                                return true;
                        }

                        return true;
                    }
                };

        plus.setOnTouchListener(dragListener);
        minus.setOnTouchListener(dragListener);

        windowManager.addView(
                panel,
                params
        );
    }

    @Override
    public void onDestroy() {

        super.onDestroy();

        if (panel != null &&
            windowManager != null) {

            try {
                windowManager.removeView(panel);
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
