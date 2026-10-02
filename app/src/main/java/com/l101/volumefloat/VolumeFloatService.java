package com.l101.volumefloat;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.media.AudioManager;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;

public class VolumeFloatService extends Service {

    private WindowManager windowManager;
    private LinearLayout panel;

    private Button mainButton;
    private Button plusButton;
    private Button minusButton;

    private AudioManager audio;
    private WindowManager.LayoutParams params;

    // 自动收起时间：3 秒
    private static final long AUTO_COLLAPSE_DELAY = 3000;

    private final Handler handler =
            new Handler(Looper.getMainLooper());

    private boolean expanded = false;

    // 拖动相关
    private float downRawX;
    private float downRawY;
    private int downX;
    private int downY;
    private boolean moved;

    private final Runnable autoCollapseRunnable =
            new Runnable() {
                @Override
                public void run() {
                    collapsePanel();
                }
            };

    @Override
    public void onCreate() {
        super.onCreate();

        audio =
                (AudioManager) getSystemService(AUDIO_SERVICE);

        createFloatButton();
    }

    private void createFloatButton() {

        windowManager =
                (WindowManager) getSystemService(WINDOW_SERVICE);

        // =========================
        // 主面板
        // =========================

        panel = new LinearLayout(this);

        panel.setOrientation(
                LinearLayout.VERTICAL
        );

        panel.setGravity(
                Gravity.CENTER_HORIZONTAL
        );

        panel.setBackgroundColor(
                Color.argb(160, 0, 0, 0)
        );

        // =========================
        // 主按钮
        // =========================

        mainButton = new Button(this);

        // 平时屏幕上只显示这个按钮
        mainButton.setText("V");

        mainButton.setTextSize(18);

        panel.addView(
                mainButton,
                new LinearLayout.LayoutParams(
                        100,
                        80
                )
        );

        // =========================
        // + 按钮
        // =========================

        plusButton = new Button(this);

        plusButton.setText("+");

        plusButton.setTextSize(20);

        panel.addView(
                plusButton,
                new LinearLayout.LayoutParams(
                        100,
                        70
                )
        );

        // =========================
        // - 按钮
        // =========================

        minusButton = new Button(this);

        minusButton.setText("-");

        minusButton.setTextSize(20);

        panel.addView(
                minusButton,
                new LinearLayout.LayoutParams(
                        100,
                        70
                )
        );

        // 初始状态：只显示主按钮
        plusButton.setVisibility(View.GONE);
        minusButton.setVisibility(View.GONE);

        // =========================
        // 窗口参数
        // =========================

        params =
                new WindowManager.LayoutParams();

        params.width = 100;

        params.height = 80;

        params.gravity =
                Gravity.RIGHT |
                Gravity.CENTER_VERTICAL;

        params.format =
                PixelFormat.TRANSLUCENT;

        params.type =
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;

        params.flags =
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;

        // =========================
        // 主按钮
        // 点击：展开/收起
        // 拖动：移动悬浮窗
        // =========================

        setDragAndClickListener(
                mainButton,
                new Runnable() {
                    @Override
                    public void run() {

                        if (expanded) {

                            collapsePanel();

                        } else {

                            expandPanel();
                        }
                    }
                }
        );

        // =========================
        // + 按钮
        // =========================

        setDragAndClickListener(
                plusButton,
                new Runnable() {
                    @Override
                    public void run() {

                        audio.adjustSuggestedStreamVolume(
                                AudioManager.ADJUST_RAISE,
                                AudioManager.USE_DEFAULT_STREAM_TYPE,
                                AudioManager.FLAG_SHOW_UI
                        );

                        scheduleAutoCollapse();
                    }
                }
        );

        // =========================
        // - 按钮
        // =========================

        setDragAndClickListener(
                minusButton,
                new Runnable() {
                    @Override
                    public void run() {

                        audio.adjustSuggestedStreamVolume(
                                AudioManager.ADJUST_LOWER,
                                AudioManager.USE_DEFAULT_STREAM_TYPE,
                                AudioManager.FLAG_SHOW_UI
                        );

                        scheduleAutoCollapse();
                    }
                }
        );

        // =========================
        // 添加悬浮窗
        // =========================

        windowManager.addView(
                panel,
                params
        );
    }

    // =========================================================
    // 设置“点击 + 拖动”监听
    // =========================================================

    private void setDragAndClickListener(
            final View target,
            final Runnable clickAction) {

        target.setOnTouchListener(
                new View.OnTouchListener() {

                    @Override
                    public boolean onTouch(
                            View v,
                            MotionEvent event) {

                        switch (event.getAction()) {

                            case MotionEvent.ACTION_DOWN:

                                // 用户开始操作时，
                                // 暂停自动收起
                                handler.removeCallbacks(
                                        autoCollapseRunnable
                                );

                                downRawX =
                                        event.getRawX();

                                downRawY =
                                        event.getRawY();

                                downX =
                                        params.x;

                                downY =
                                        params.y;

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
                                     * Gravity.RIGHT：
                                     *
                                     * 向右拖：
                                     * x 减小
                                     *
                                     * 向左拖：
                                     * x 增大
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

                                    // 没有发生拖动
                                    // 才认为是点击
                                    clickAction.run();
                                } else {

                                    // 拖动结束
                                    // 如果当前已经展开，
                                    // 重新开始自动收起倒计时
                                    if (expanded) {
                                        scheduleAutoCollapse();
                                    }
                                }

                                return true;

                            case MotionEvent.ACTION_CANCEL:

                                if (expanded) {
                                    scheduleAutoCollapse();
                                }

                                return true;
                        }

                        return true;
                    }
                }
        );
    }

    // =========================================================
    // 展开
    // =========================================================

    private void expandPanel() {

        expanded = true;

        plusButton.setVisibility(
                View.VISIBLE
        );

        minusButton.setVisibility(
                View.VISIBLE
        );

        params.width = 100;

        params.height = 220;

        windowManager.updateViewLayout(
                panel,
                params
        );

        scheduleAutoCollapse();
    }

    // =========================================================
    // 收起
    // =========================================================

    private void collapsePanel() {

        expanded = false;

        handler.removeCallbacks(
                autoCollapseRunnable
        );

        plusButton.setVisibility(
                View.GONE
        );

        minusButton.setVisibility(
                View.GONE
        );

        params.width = 100;

        params.height = 80;

        windowManager.updateViewLayout(
                panel,
                params
        );
    }

    // =========================================================
    // 自动收起
    // =========================================================

    private void scheduleAutoCollapse() {

        handler.removeCallbacks(
                autoCollapseRunnable
        );

        handler.postDelayed(
                autoCollapseRunnable,
                AUTO_COLLAPSE_DELAY
        );
    }

    // =========================================================
    // Service 销毁
    // =========================================================

    @Override
    public void onDestroy() {

        handler.removeCallbacks(
                autoCollapseRunnable
        );

        if (panel != null &&
            windowManager != null) {

            try {

                windowManager.removeView(
                        panel
                );

            } catch (Exception ignored) {
            }
        }

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
