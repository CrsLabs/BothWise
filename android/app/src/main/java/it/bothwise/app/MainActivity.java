package it.bothwise.app;

import android.content.Intent;
import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(pairwood.capacitor.PairWoodPlugin.class);   // la sincronizzazione (PairWood)
        registerPlugin(BothWisePlugin.class);                               // dimensione del testo
        super.onCreate(savedInstanceState);
        // nell'elenco delle app recenti non si vede il contenuto (cartelle, dispositivi): da Android 13
        if (android.os.Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false);
        BothWisePlugin.ricevi(getIntent()); BothWisePlugin.daTile(getIntent());   // aperta con «Condividi con BothWise»
        avvisaTastiera();
        // Indietro: chiude la finestra aperta nella pagina; se non ce n'è, l'app va in secondo piano (non si chiude)
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                android.webkit.WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv == null) { moveTaskToBack(true); return; }
                wv.evaluateJavascript("(window.__indietro && window.__indietro()) ? 'si' : 'no'", r -> {
                    if (!"\"si\"".equals(r)) moveTaskToBack(true);
                });
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        BothWisePlugin.ricevi(intent);
        BothWisePlugin.daTile(intent);
    }
    /** Dice alla pagina quanto della finestra è coperto dalla tastiera (px della pagina), così la finestra si accorcia e scorre. */
    private int tastieraVista = -1;
    private void avvisaTastiera() {
        final android.view.View dv = getWindow().getDecorView();
        androidx.core.view.ViewCompat.setWindowInsetsAnimationCallback(dv,
            new androidx.core.view.WindowInsetsAnimationCompat.Callback(androidx.core.view.WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
                @Override
                public androidx.core.view.WindowInsetsCompat onProgress(androidx.core.view.WindowInsetsCompat insets,
                                                                        java.util.List<androidx.core.view.WindowInsetsAnimationCompat> animazioni) {
                    dallaTastiera(insets);
                    return insets;
                }
                @Override
                public void onEnd(androidx.core.view.WindowInsetsAnimationCompat animazione) {
                    dallaTastiera(androidx.core.view.ViewCompat.getRootWindowInsets(dv));
                }
            });
    }
    private void dallaTastiera(androidx.core.view.WindowInsetsCompat wi) {
        if (wi == null) return;
        int kb = wi.isVisible(androidx.core.view.WindowInsetsCompat.Type.ime()) ? wi.getInsets(androidx.core.view.WindowInsetsCompat.Type.ime()).bottom : 0;
        if (kb == tastieraVista) return;
        tastieraVista = kb;
        final android.webkit.WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv == null) return;
        final int px = Math.round(kb / getResources().getDisplayMetrics().density);
        wv.post(() -> wv.evaluateJavascript("window.__tastiera&&window.__tastiera(" + px + ")", null));
    }

    /** Pausa e ripresa dell'app: la pagina decide se bloccare (anche quando si apre solo l'elenco delle app recenti). */
    private void alla(String funzione) {
        final android.webkit.WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null) wv.post(() -> wv.evaluateJavascript("window." + funzione + "&&window." + funzione + "()", null));
    }
    @Override
    public void onPause() { pausata = !isChangingConfigurations() && !isInMultiWindowMode(); if (pausata) alla("__pausaApp"); super.onPause(); }
    /** Messa in pausa da Android (app recenti, Home, schermo spento): al ritorno la pagina decide se chiedere l'impronta. Le finestre affiancate e la tendina delle notifiche non fermano l'app: non contano. */
    private boolean pausata = false;
    @Override
    public void onResume() { super.onResume(); if (pausata) { pausata = false; alla("__pausaApp"); alla("__ripresaApp"); } }

    // la frequenza dello schermo la sceglie chi usa l'app (Impostazioni → Aspetto → Fluidità dello schermo): BothWisePlugin.impostaFrequenza


    /**
     * Il gesto delle app recenti toglie all'app il primo piano (anche senza fermarla): conta come uscire. La tendina delle
     * notifiche no (l'app resta in primo piano), e nemmeno passare all'altra di due finestre affiancate.
     */
    @Override
    public void onTopResumedActivityChanged(boolean primoPiano) {
        super.onTopResumedActivityChanged(primoPiano);
        if (!primoPiano) { if (!isInMultiWindowMode() && !isChangingConfigurations() && !pausata) { pausata = true; alla("__pausaApp"); } }
        else if (pausata) { pausata = false; alla("__pausaApp"); alla("__ripresaApp"); }
    }
}
