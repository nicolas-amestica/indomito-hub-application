package cl.girasindomito.hub.tv;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Message;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SafeBrowsingResponse;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

/** Contenedor TV de Indómito Hub basado en WebView. */
public final class MainActivity extends Activity {
    private static final String HUB_URL = "https://nuevo.admin.girasindomito.cl";
    private static final int FILE_CHOOSER_REQUEST = 1001;

    private WebView webView;
    private ProgressBar progressBar;
    private TextView errorView;
    private ValueCallback<Uri[]> pendingFileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureFullscreen();
        setContentView(createContentView());
        configureWebView();
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                this::handleBack
            );
        }

        if (savedInstanceState == null) {
            webView.loadUrl(HUB_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private View createContentView() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 11, 17));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(8, 11, 17));
        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progressBar, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            6
        ));

        errorView = new TextView(this);
        errorView.setTextColor(Color.WHITE);
        errorView.setTextSize(22);
        errorView.setGravity(android.view.Gravity.CENTER);
        errorView.setPadding(64, 64, 64, 64);
        errorView.setFocusable(true);
        errorView.setVisibility(View.GONE);
        errorView.setOnClickListener(view -> reloadHub());
        root.addView(errorView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        return root;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setSupportMultipleWindows(false);
        webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        webView.getSettings().setBuiltInZoomControls(false);
        webView.getSettings().setDisplayZoomControls(false);
        webView.getSettings().setUseWideViewPort(true);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setWebViewClient(new HubWebViewClient());
        webView.setWebChromeClient(new HubWebChromeClient());
        webView.requestFocus(View.FOCUS_FORWARD);
    }

    private void configureFullscreen() {
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        }
    }

    private void reloadHub() {
        errorView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(HUB_URL);
        webView.requestFocus();
    }

    private void showMainFrameError() {
        webView.setVisibility(View.GONE);
        errorView.setText(R.string.load_error);
        errorView.setVisibility(View.VISIBLE);
        errorView.requestFocus();
    }

    private boolean openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (errorView.getVisibility() == View.VISIBLE
            && event.getAction() == KeyEvent.ACTION_UP
            && (event.getKeyCode() == KeyEvent.KEYCODE_DPAD_CENTER
                || event.getKeyCode() == KeyEvent.KEYCODE_ENTER)) {
            reloadHub();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    @SuppressLint("GestureBackNavigation")
    public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        if (errorView.getVisibility() == View.VISIBLE) {
            reloadHub();
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        configureFullscreen();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (pendingFileCallback != null) {
            pendingFileCallback.onReceiveValue(null);
            pendingFileCallback = null;
        }
        webView.stopLoading();
        webView.setWebChromeClient(null);
        webView.setWebViewClient(null);
        webView.destroy();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || pendingFileCallback == null) {
            return;
        }
        pendingFileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
        pendingFileCallback = null;
    }

    private final class HubWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if ("https".equalsIgnoreCase(uri.getScheme())) {
                return false;
            }
            return openExternal(uri);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            CookieManager.getInstance().flush();
            view.requestFocus();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                showMainFrameError();
            }
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();
            showMainFrameError();
        }

        @Override
        @TargetApi(27)
        public void onSafeBrowsingHit(
            WebView view,
            WebResourceRequest request,
            int threatType,
            SafeBrowsingResponse callback
        ) {
            callback.backToSafety(true);
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            recreate();
            return true;
        }
    }

    private final class HubWebChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
        }

        @Override
        public boolean onShowFileChooser(
            WebView view,
            ValueCallback<Uri[]> filePathCallback,
            FileChooserParams fileChooserParams
        ) {
            if (pendingFileCallback != null) {
                pendingFileCallback.onReceiveValue(null);
            }
            pendingFileCallback = filePathCallback;
            try {
                startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST);
                return true;
            } catch (ActivityNotFoundException exception) {
                pendingFileCallback = null;
                return false;
            }
        }

        @Override
        public boolean onCreateWindow(
            WebView view,
            boolean isDialog,
            boolean isUserGesture,
            Message resultMsg
        ) {
            return false;
        }
    }
}
