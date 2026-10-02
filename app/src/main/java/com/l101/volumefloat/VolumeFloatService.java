package com.l101.volumefloat;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

public class VolumeFloatService extends Service {

    private WindowManager windowManager;
    private LinearLayout panel;

    private TextView mainButton;
    private TextView plusButton;
    private TextView minusButton;

    private AudioManager audio;
    private WindowManager.LayoutParams params;

    // 自动收起时间：2.5 秒
    private static final long AUTO_COLLAPSE_DELAY = 2500;

    // 常驻按钮尺寸
    private static final int MAIN_SIZE = 48;

    // 展开后按钮尺寸
    private static final int SMALL_SIZE = 48;

    // 按钮间距
    private static final int BUTTON_GAP = 4;

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

        // ==========================================
        // 主面板
        // ==========================================

        panel = new LinearLayout(this);

        panel.setOrientation(
                LinearLayout.VERTICAL
        );

        panel.setGravity(
                Gravity.CENTER
        );

        // 面板本身完全透明
        panel.setBackgroundColor(
                Color.TRANSPARENT
        );

        // ==========================================
        // 主按钮
        // ==========================================

        mainButton = createCircleButton(
                "V",
                MAIN_SIZE
        );

        mainButton.setTextSize(14);

        panel.addView(
                mainButton,
                new LinearLayout.LayoutParams(
                        MAIN_SIZE,
                        MAIN_SIZE
                )
        );

        // ==========================================
        // +
        // ==========================================

        plusButton = createCircleButton(
                "+",
                SMALL_SIZE
        );

        plusButton.setTextSize(20);

        LinearLayout.LayoutParams plusParams =
                new LinearLayout.LayoutParams(
                        SMALL_SIZE,
                        SMALL_SIZE
                );

        plusParams.topMargin = BUTTON_GAP;

        panel.addView(
                plusButton,
                plusParams
        );

        // ==========================================
        // -
        // ==========================================

        minusButton = createCircleButton(
                "-",
                SMALL_SIZE
        );

        minusButton.setTextSize(20);

        LinearLayout.LayoutParams minusParams =
                new LinearLayout.LayoutParams(
                        SMALL_SIZE,
                        SMALL_SIZE
                );

        minusParams.topMargin = BUTTON_GAP;

        panel.addView(
                minusButton,
                minusParams
        );

        // ==========================================
        // 初始只显示 V
        // ==========================================

        plusButton.setVisibility(
                View.GONE
        );

        minusButton.setVisibility(
                View.GONE
        );

        // ==========================================
        // WindowManager 参数
        // ==========================================

        params =
                new WindowManager.LayoutParams();

        params.width = MAIN_SIZE;

        params.height = MAIN_SIZE;

        params.gravity =
                Gravity.RIGHT |
                Gravity.CENTER_VERTICAL;

        params.x = 2;

        params.format =
                PixelFormat.TRANSLUCENT;

        params.type =
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;

        params.flags =
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;

        // ==========================================
        // 主按钮
        // ==========================================

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

        // ==========================================
        // +
        // ==========================================

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

        // ==========================================
        // -
        // ==========================================

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

        // ==========================================
        // 添加悬浮窗
        // ==========================================

        windowManager.addView(
                panel,
                params
        );
    }

    // =====================================================
    // 创建圆形按钮
    // =====================================================

    private TextView createCircleButton(
            String text,
            int size) {

        TextView button =
                new TextView(this);

        button.setText(text);

        button.setTextColor(
                Color.WHITE
        );

        button.setGravity(
                Gravity.CENTER
        );

        button.setIncludeFontPadding(
                false
        );

        button.setBackground(
                createCircleBackground()
        );

        return button;
    }

    // =====================================================
    // 圆形半透明背景
    // =====================================================

    private GradientDrawable createCircleBackground() {

        GradientDrawable drawable =
                new GradientDrawable();

        drawable.setShape(
                GradientDrawable.OVAL
        );

        /*
         * 黑色 + 约 55% 透明度
         *
         * 比之前的黑色矩形悬浮窗
         * 更不遮挡画面。
         */
        drawable.setColor(
                Color.argb(140, 0, 0, 0)
        );

        return drawable;
    }

    // =====================================================
    // 点击 + 拖动
    // =====================================================

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
                                     * 向右拖 -> x 减小
                                     * 向左拖 -> x 增大
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

                                    clickAction.run();

                                } else {

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

    // =====================================================
    // 展开
    // =====================================================

    private void expandPanel() {

        expanded = true;

        plusButton.setVisibility(
                View.VISIBLE
        );

        minusButton.setVisibility(
                View.VISIBLE
        );

        params.width =
                SMALL_SIZE;

        params.height =
                MAIN_SIZE
                + SMALL_SIZE
                + SMALL_SIZE
                + BUTTON_GAP
                + BUTTON_GAP;

        windowManager.updateViewLayout(
                panel,
                params
        );

        scheduleAutoCollapse();
    }

    // =====================================================
    // 收起
    // =====================================================

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

        params.width =
                MAIN_SIZE;

        params.height =
                MAIN_SIZE;

        windowManager.updateViewLayout(
                panel,
                params
        );
    }

    // =====================================================
    // 自动收起
    // =====================================================

    private void scheduleAutoCollapse() {

        handler.removeCallbacks(
                autoCollapseRunnable
        );

        handler.postDelayed(
                autoCollapseRunnable,
                AUTO_COLLAPSE_DELAY
        );
    }

    // =====================================================
    // Service 销毁
    // =====================================================

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
