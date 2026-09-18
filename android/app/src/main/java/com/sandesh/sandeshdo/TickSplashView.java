package com.sandesh.sandeshdo;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathMeasure;
import android.util.TypedValue;
import android.view.View;
import android.view.animation.PathInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;

/** Same teal tick as the live web splash. */
public class TickSplashView extends FrameLayout {
    private final TickCanvas tick;

    public TickSplashView(Context ctx) {
        super(ctx);
        setBackgroundColor(Color.parseColor("#0B6B58"));
        setClickable(true);
        LinearLayout col = new LinearLayout(ctx);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER);
        tick = new TickCanvas(ctx);
        int size = (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 72, getResources().getDisplayMetrics());
        LinearLayout.LayoutParams tickLp = new LinearLayout.LayoutParams(size, size);
        tickLp.bottomMargin = (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 16, getResources().getDisplayMetrics());
        col.addView(tick, tickLp);
        TextView title = new TextView(ctx);
        title.setText("SandeshDo");
        title.setTextColor(Color.parseColor("#F6F3EC"));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 34);
        title.setTypeface(Typeface.create("serif", Typeface.NORMAL));
        title.setGravity(Gravity.CENTER);
        title.setAlpha(0f);
        title.animate().alpha(1f).setStartDelay(180).setDuration(400).start();
        TextView tag = new TextView(ctx);
        tag.setText("Remember · Do · Finish");
        tag.setTextColor(Color.parseColor("#C9EDE4"));
        tag.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        tag.setLetterSpacing(0.16f);
        tag.setGravity(Gravity.CENTER);
        tag.setPadding(0, 16, 0, 0);
        tag.setAlpha(0f);
        tag.animate().alpha(1f).setStartDelay(280).setDuration(400).start();
        col.addView(title);
        col.addView(tag);
        FrameLayout.LayoutParams lp =
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        addView(col, lp);
        tick.start();
    }

    static class TickCanvas extends View {
        private final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint mark = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path tickPath = new Path();
        private final PathMeasure measure = new PathMeasure();
        private float ringT;
        private float tickT;

        TickCanvas(Context ctx) {
            super(ctx);
            ring.setStyle(Paint.Style.STROKE);
            ring.setColor(Color.parseColor("#F6F3EC"));
            ring.setStrokeWidth(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 2.4f, getResources().getDisplayMetrics()));
            mark.setStyle(Paint.Style.STROKE);
            mark.setColor(Color.parseColor("#F6F3EC"));
            mark.setStrokeCap(Paint.Cap.ROUND);
            mark.setStrokeJoin(Paint.Join.ROUND);
            mark.setStrokeWidth(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 4.2f, getResources().getDisplayMetrics()));
        }

        void start() {
            PathInterpolator ease = new PathInterpolator(0.2f, 0f, 0f, 1f);
            ValueAnimator ringAnim = ValueAnimator.ofFloat(0f, 1f);
            ringAnim.setDuration(620);
            ringAnim.setInterpolator(ease);
            ringAnim.addUpdateListener(
                    a -> {
                        ringT = (float) a.getAnimatedValue();
                        invalidate();
                    });
            ValueAnimator tickAnim = ValueAnimator.ofFloat(0f, 1f);
            tickAnim.setDuration(360);
            tickAnim.setStartDelay(220);
            tickAnim.setInterpolator(ease);
            tickAnim.addUpdateListener(
                    a -> {
                        tickT = (float) a.getAnimatedValue();
                        invalidate();
                    });
            ringAnim.start();
            tickAnim.start();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float w = getWidth();
            float h = getHeight();
            float cx = w / 2f;
            float cy = h / 2f;
            float r = Math.min(w, h) * 0.42f;
            ring.setAlpha(Math.round(0.32f * 255 * ringT));
            canvas.drawArc(cx - r, cy - r, cx + r, cy + r, -90, 360 * ringT, false, ring);
            tickPath.reset();
            float s = Math.min(w, h) / 72f;
            tickPath.moveTo(22 * s, 38 * s);
            tickPath.lineTo(32 * s, 48 * s);
            tickPath.lineTo(52 * s, 26 * s);
            measure.setPath(tickPath, false);
            Path dst = new Path();
            measure.getSegment(0, measure.getLength() * tickT, dst, true);
            canvas.drawPath(dst, mark);
        }
    }
}
