package com.sandesh.sandeshdo;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.LinearLayout;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;

public class MainActivity extends AppCompatActivity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final Uri INDEX = Uri.parse(ORIGIN + "/index.html");

    private static WeakReference<MainActivity> live = new WeakReference<>(null);
    private WebView webView;
    private PermissionRequest pendingWebPermission;
    private boolean askedNotify;
    private View splashView;
    private FrameLayout root;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        live = new WeakReference<>(this);
        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#0B6B58"));
        window.setNavigationBarColor(Color.parseColor("#0B6B58"));
        WindowCompat.setDecorFitsSystemWindows(window, true);
        WindowInsetsControllerCompat insets = WindowCompat.getInsetsController(window, window.getDecorView());
        insets.setAppearanceLightStatusBars(false);
        insets.setAppearanceLightNavigationBars(false);

        if (!webViewAvailable()) {
            setContentView(missingWebViewScreen());
            return;
        }

        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            /* wait for hideSplash — don't flash a permission over the splash */
        } else {
            new Handler(Looper.getMainLooper()).postDelayed(() -> AlarmService.seedHeadsUp(this), 1800);
        }

        AlarmService.ensureChannel(this);
        AlarmScheduler.scheduleSaved(this);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0B6B58"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root = new FrameLayout(this);
        root.addView(
                webView,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        splashView = buildSplash();
        root.addView(
                splashView,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(false);
        }

        WebViewAssetLoader assetLoader =
                new WebViewAssetLoader.Builder()
                        .setDomain("appassets.androidplatform.net")
                        .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                        .build();

        webView.setWebViewClient(new AppClient(assetLoader));
        webView.setWebChromeClient(
                new WebChromeClient() {
                    @Override
                    public boolean onCreateWindow(
                            WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                        return false;
                    }

                    @Override
                    public void onPermissionRequest(PermissionRequest request) {
                        runOnUiThread(() -> handleWebPermission(request));
                    }
                });
        webView.addJavascriptInterface(new HostBridge(this), "SandeshDoHost");

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            bootFromAssets();
        }
        handleOpenTask(getIntent());
        new Handler(Looper.getMainLooper()).postDelayed(this::hideSplash, 1400);

                        getOnBackPressedDispatcher()
                                .addCallback(
                                        this,
                                        new OnBackPressedCallback(true) {
                                            @Override
                                            public void handleOnBackPressed() {
                                                if (webView == null) {
                                                    setEnabled(false);
                                                    getOnBackPressedDispatcher().onBackPressed();
                                                    return;
                                                }
                                                webView.evaluateJavascript(
                                                        "(function(){try{return window.__sdOnBack&&window.__sdOnBack()?'1':'0';}catch(e){return '0';}})()",
                                                        value -> {
                                                            boolean consumed =
                                                                    value != null
                                                                            && (value.contains("1"));
                                                            if (consumed) return;
                                                            if (webView.canGoBack()) {
                                                                webView.goBack();
                                                            } else {
                                                                setEnabled(false);
                                                                getOnBackPressedDispatcher().onBackPressed();
                                                            }
                                                        });
                                            }
                                        });
    }

    private void bootFromAssets() {
        String html = readAsset("index.html");
        if (html == null) {
            webView.loadUrl(INDEX.toString());
            return;
        }
        // Load HTML directly so the system never tries to open a browser for the first page.
        webView.loadDataWithBaseURL(ORIGIN + "/", html, "text/html", "utf-8", null);
    }

    @Nullable
    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name);
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) {
                out.write(buf, 0, n);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static boolean webViewAvailable() {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                return WebView.getCurrentWebViewPackage() != null;
            }
            return true;
        } catch (Throwable ignored) {
            return true;
        }
    }

    private View missingWebViewScreen() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#ECE8DF"));
        TextView text = new TextView(this);
        text.setText(
                "SandeshDo needs Android System WebView.\n\nOpen the Play Store, install “Android System WebView”, then open SandeshDo again.");
        text.setTextColor(Color.parseColor("#171614"));
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        text.setTypeface(Typeface.SANS_SERIF);
        text.setGravity(Gravity.CENTER);
        text.setPadding(48, 48, 48, 48);
        FrameLayout.LayoutParams lp =
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        root.addView(text, lp);
        return root;
    }

    private View buildSplash() {
        FrameLayout splash = new FrameLayout(this);
        splash.setBackgroundColor(Color.parseColor("#0B6B58"));
        splash.setClickable(true);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER);
        TextView title = new TextView(this);
        title.setText("SandeshDo");
        title.setTextColor(Color.parseColor("#F6F3EC"));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 34);
        title.setTypeface(Typeface.create("serif", Typeface.NORMAL));
        title.setGravity(Gravity.CENTER);
        TextView tag = new TextView(this);
        tag.setText("Remember · Do · Finish");
        tag.setTextColor(Color.parseColor("#C9EDE4"));
        tag.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        tag.setGravity(Gravity.CENTER);
        tag.setPadding(0, 16, 0, 0);
        col.addView(title);
        col.addView(tag);
        FrameLayout.LayoutParams lp =
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        splash.addView(col, lp);
        return splash;
    }

    public void hideSplash() {
        if (splashView == null) return;
        final View overlay = splashView;
        splashView = null;
        if (webView != null) webView.setBackgroundColor(Color.parseColor("#EFE8DC"));
        overlay.animate()
                .alpha(0f)
                .setDuration(220)
                .withEndAction(
                        () -> {
                            if (overlay.getParent() instanceof ViewGroup) {
                                ((ViewGroup) overlay.getParent()).removeView(overlay);
                            }
                            Window window = getWindow();
                            window.setNavigationBarColor(Color.parseColor("#EFE8DC"));
                            WindowInsetsControllerCompat insets =
                                    WindowCompat.getInsetsController(window, window.getDecorView());
                            insets.setAppearanceLightNavigationBars(true);
                        })
                .start();
        new Handler(Looper.getMainLooper()).postDelayed(this::maybeAskNotifications, 400);
    }

    private void maybeAskNotifications() {
        if (isFinishing() || askedNotify) return;
        askedNotify = true;
        if (Build.VERSION.SDK_INT < 33) {
            AlarmService.seedHeadsUp(this);
            return;
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) {
            AlarmService.seedHeadsUp(this);
            return;
        }
        try {
            new AlertDialog.Builder(this)
                    .setTitle("Allow reminders")
                    .setMessage("SandeshDo shows a small banner when a task is due — even if the app is closed.")
                    .setPositiveButton(
                            "Allow",
                            (d, w) ->
                                    ActivityCompat.requestPermissions(
                                            this, new String[] {Manifest.permission.POST_NOTIFICATIONS}, 7))
                    .setNegativeButton("Not now", null)
                    .show();
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleOpenTask(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.evaluateJavascript(
                    "(function(){window.dispatchEvent(new Event('sandeshdo:native-resume'));})();", null);
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 7) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) AlarmService.seedHeadsUp(this);
        }
        if (requestCode == 8 && pendingWebPermission != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            try {
                if (granted) pendingWebPermission.grant(pendingWebPermission.getResources());
                else pendingWebPermission.deny();
            } catch (Exception ignored) {
            }
            pendingWebPermission = null;
        }
        if (webView != null) {
            webView.evaluateJavascript(
                    "(function(){window.dispatchEvent(new Event('sandeshdo:native-resume'));})();", null);
        }
    }

    private void handleWebPermission(PermissionRequest request) {
        String[] resources = request.getResources();
        boolean wantsMic = false;
        for (String r : resources) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsMic = true;
        }
        if (!wantsMic) {
            request.deny();
            return;
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED) {
            request.grant(resources);
            return;
        }
        pendingWebPermission = request;
        ActivityCompat.requestPermissions(this, new String[] {Manifest.permission.RECORD_AUDIO}, 8);
    }

    private void handleOpenTask(android.content.Intent intent) {
        if (intent == null || webView == null) return;
        String id = intent.getStringExtra("taskId");
        if (id == null || id.isEmpty() || "test".equals(id)) return;
        String js =
                "(function(){window.dispatchEvent(new CustomEvent('sandeshdo:open-task',{detail:"
                        + org.json.JSONObject.quote(id)
                        + "}));})();";
        webView.postDelayed(() -> webView.evaluateJavascript(js, null), 400);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private static final class AppClient extends WebViewClient {
        private final WebViewAssetLoader assetLoader;

        AppClient(WebViewAssetLoader assetLoader) {
            this.assetLoader = assetLoader;
        }

        @Override
        public boolean shouldOverrideUrlLoading(@NonNull WebView view, @NonNull WebResourceRequest request) {
            return handleUrl(view, request.getUrl());
        }

        @Deprecated
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUrl(view, Uri.parse(url));
        }

        private boolean handleUrl(WebView view, Uri uri) {
            if (uri == null) return true;
            String scheme = uri.getScheme();
            if ("https".equals(scheme) || "http".equals(scheme)) {
                view.loadUrl(uri.toString());
            }
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (url == null) return null;
            String host = url.getHost();
            if (host == null || !host.equals("appassets.androidplatform.net")) {
                return null;
            }
            WebResourceResponse found = assetLoader.shouldInterceptRequest(url);
            if (found != null) return found;
            String path = url.getPath();
            if (path == null || path.equals("/") || !looksLikeFile(path)) {
                return assetLoader.shouldInterceptRequest(INDEX);
            }
            return null;
        }

        private static boolean looksLikeFile(String path) {
            int slash = path.lastIndexOf('/');
            String last = slash >= 0 ? path.substring(slash + 1) : path;
            return last.contains(".");
        }
    }
}
