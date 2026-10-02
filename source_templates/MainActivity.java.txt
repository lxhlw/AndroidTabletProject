package com.l101.volumefloat;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;


public class MainActivity extends Activity {


    @Override
    public void onCreate(Bundle savedInstanceState){

        super.onCreate(savedInstanceState);


        Intent intent =
        new Intent(
            this,
            VolumeFloatService.class
        );


        startService(intent);


    }

}