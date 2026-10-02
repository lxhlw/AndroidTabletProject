package com.l101.volumefloat;


import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;



public class FloatPermission {


    public static boolean check(
        Context context
    ){


        // Android 4.4 默认允许 SYSTEM_ALERT_WINDOW
        // 部分国产ROM需要用户手动开启


        if(Build.VERSION.SDK_INT < 23){

            return true;

        }


        return true;


    }


}