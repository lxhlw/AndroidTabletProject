package com.l101.volumefloat;


import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.media.AudioManager;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;



public class VolumeFloatService extends Service {


    private WindowManager windowManager;

    private LinearLayout panel;

    private AudioManager audio;



    @Override
    public void onCreate(){

        super.onCreate();


        audio =
        (AudioManager)getSystemService(
        AUDIO_SERVICE);



        createFloatButton();

    }



    private void createFloatButton(){


        windowManager =
        (WindowManager)getSystemService(
        WINDOW_SERVICE);



        panel =
        new LinearLayout(this);


        panel.setOrientation(
        LinearLayout.VERTICAL);


        panel.setBackgroundColor(
        Color.argb(160,0,0,0));



        Button plus =
        new Button(this);

        plus.setText("+");



        Button minus =
        new Button(this);

        minus.setText("-");



        panel.addView(
        plus,
        new LinearLayout.LayoutParams(
        90,80));



        panel.addView(
        minus,
        new LinearLayout.LayoutParams(
        90,80));



        plus.setOnClickListener(v->{


            audio.adjustStreamVolume(
            AudioManager.STREAM_MUSIC,
            AudioManager.ADJUST_RAISE,
            0);


        });



        minus.setOnClickListener(v->{


            audio.adjustStreamVolume(
            AudioManager.STREAM_MUSIC,
            AudioManager.ADJUST_LOWER,
            0);


        });



        WindowManager.LayoutParams params =
        new WindowManager.LayoutParams();


        params.width=100;

        params.height=170;


        params.gravity =
        Gravity.RIGHT |
        Gravity.CENTER_VERTICAL;


        params.format =
        PixelFormat.TRANSLUCENT;



        params.type =
        WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;



        params.flags =
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;



        windowManager.addView(
        panel,
        params);


    }




    @Override
    public IBinder onBind(Intent intent){

        return null;

    }


}