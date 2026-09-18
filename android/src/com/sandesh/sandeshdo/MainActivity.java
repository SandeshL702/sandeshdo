package com.sandesh.sandeshdo;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;

public class MainActivity extends Activity {
  private WebView webView;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    requestWindowFeature(Window.FEATURE_NO_TITLE);
    Window window = getWindow();
    window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
    window.setStatusBarColor(Color.parseColor("#0B6B58"));
    window.setNavigationBarColor(Color.parseColor("#0C0D0C"));
    if (Build.VERSION.SDK_INT >= 33) {
      requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 1);
    }

    webView = new WebView(this);
    webView.setBackgroundColor(Color.parseColor("#ECE8DF"));
    setContentView(webView);

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    if (Build.VERSION.SDK_INT >= 21) {
      settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
    }

    webView.setWebChromeClient(new WebChromeClient());
    webView.addJavascriptInterface(new Bridge(this), "SandeshDoNative");
    webView.setWebViewClient(
        new WebViewClient() {
          @Override
          public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String host = request.getUrl().getHost();
            if (host == null || !host.equals("sandeshdo.local")) {
              return null;
            }
            String path = request.getUrl().getPath();
            if (path == null || path.isEmpty() || path.equals("/")) {
              path = "/index.html";
            }
            try {
              InputStream stream = getAssets().open("www" + path);
              return new WebResourceResponse(mimeType(path), "utf-8", stream);
            } catch (Exception ignored) {
              if (!path.equals("/index.html")) {
                try {
                  InputStream stream = getAssets().open("www/index.html");
                  return new WebResourceResponse("text/html", "utf-8", stream);
                } catch (Exception ignored2) {
                  return null;
                }
              }
              return null;
            }
          }
        });
    webView.loadUrl("https://sandeshdo.local/");
  }

  @Override
  public void onBackPressed() {
    if (webView != null && webView.canGoBack()) {
      webView.goBack();
      return;
    }
    super.onBackPressed();
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (webView != null) {
      webView.onResume();
    }
  }

  @Override
  protected void onPause() {
    if (webView != null) {
      webView.onPause();
    }
    super.onPause();
  }

  static String mimeType(String path) {
    String lower = path.toLowerCase();
    if (lower.endsWith(".js")) return "text/javascript";
    if (lower.endsWith(".css")) return "text/css";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".svg")) return "image/svg+xml";
    if (lower.endsWith(".json") || lower.endsWith(".webmanifest")) return "application/manifest+json";
    if (lower.endsWith(".woff2")) return "font/woff2";
    if (lower.endsWith(".woff")) return "font/woff";
    if (lower.endsWith(".html")) return "text/html";
    return "application/octet-stream";
  }

  public static class Bridge {
    private final Context context;

    Bridge(Context context) {
      this.context = context;
    }

    @JavascriptInterface
    public void vibrate(int milliseconds) {
      Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
      if (vibrator == null) return;
      int ms = Math.max(20, Math.min(milliseconds, 2000));
      if (Build.VERSION.SDK_INT >= 26) {
        vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
      } else {
        vibrator.vibrate(ms);
      }
    }
  }
}
