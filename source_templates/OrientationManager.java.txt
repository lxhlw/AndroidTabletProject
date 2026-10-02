package com.l101.volumefloat;


import android.content.Context;
import android.content.res.Configuration;
import android.view.Gravity;
import android.view.WindowManager;



public class OrientationManager {


    private WindowManager.LayoutParams params;



    public OrientationManager(
        WindowManager.LayoutParams p
    ){

        params = p;

    }



    public void update(
        Context context
    ){


        int orientation =
        context.getResources()
        .getConfiguration()
        .orientation;



        if(
        orientation ==
        Configuration.ORIENTATION_LANDSCAPE
        ){


            params.gravity =
            Gravity.RIGHT |
            Gravity.CENTER_VERTICAL;



        }
        else
        {


            params.gravity =
            Gravity.RIGHT |
            Gravity.CENTER;



        }



    }


}