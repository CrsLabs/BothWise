package it.bothwise.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ciò che serve solo a BothWise (il resto è in PairWood): la dimensione del testo e la vibrazione, come in DoctorWood;
 * i file arrivati con «Condividi con BothWise».
 */
@CapacitorPlugin(name = "BothWise")
public class BothWisePlugin extends Plugin {
    private static final String PREF = "bothwise_aspetto";

    // ---------- «Condividi con BothWise» ----------
    private static final java.util.List<String> condivisi = new java.util.ArrayList<>();
    private static BothWisePlugin attivo;
    static final String EXTRA_INVIA_RICEVI = "bothwise_invia_ricevi";
    private static boolean inviaRicevi = false;

    /** Da MainActivity: l'app è stata aperta dal tasto della barra rapida → la pagina mostra «Invia e ricevi». */
    static void daTile(android.content.Intent i) {
        if (i == null || !i.getBooleanExtra(EXTRA_INVIA_RICEVI, false)) return;
        i.removeExtra(EXTRA_INVIA_RICEVI);
        inviaRicevi = true;
        BothWisePlugin p = attivo;
        if (p != null) p.notifyListeners("inviaRicevi", new com.getcapacitor.JSObject(), true);
    }

    /** inviaRicevi() → { si: true } se l'app è stata aperta dal tasto della barra rapida (e lo dimentica). */
    @PluginMethod
    public void inviaRicevi(PluginCall call) {
        boolean s = inviaRicevi; inviaRicevi = false;
        call.resolve(new com.getcapacitor.JSObject().put("si", s));
    }

    /** Da MainActivity: se l'app è stata aperta da «Condividi», si ricordano i file e si avvisa la pagina. */
    static void ricevi(android.content.Intent i) {
        if (i == null) return;
        String a = i.getAction();
        java.util.List<android.net.Uri> uri = new java.util.ArrayList<>();
        if (android.content.Intent.ACTION_SEND.equals(a)) {
            android.net.Uri u = android.os.Build.VERSION.SDK_INT >= 33
                ? i.getParcelableExtra(android.content.Intent.EXTRA_STREAM, android.net.Uri.class) : streamVecchio(i);
            if (u != null) uri.add(u);
        } else if (android.content.Intent.ACTION_SEND_MULTIPLE.equals(a)) {
            java.util.ArrayList<android.net.Uri> l = android.os.Build.VERSION.SDK_INT >= 33
                ? i.getParcelableArrayListExtra(android.content.Intent.EXTRA_STREAM, android.net.Uri.class) : streamsVecchi(i);
            if (l != null) uri.addAll(l);
        } else return;
        synchronized (condivisi) {
            for (android.net.Uri u : uri) // solo documenti di altre app: mai gli indirizzi dell'app stessa (un'altra app non deve farle copiare i suoi dati privati)
                if ("content".equals(u.getScheme()) && u.getAuthority() != null && !u.getAuthority().startsWith("it.bothwise.app") && condivisi.size() < 500) condivisi.add(u.toString());
        }
        BothWisePlugin p = attivo;
        if (p != null) p.notifyListeners("condivisi", new com.getcapacitor.JSObject().put("quanti", condivisi.size()), true);
    }

    @SuppressWarnings("deprecation")
    private static android.net.Uri streamVecchio(android.content.Intent i) { return i.getParcelableExtra(android.content.Intent.EXTRA_STREAM); }
    @SuppressWarnings("deprecation")
    private static java.util.ArrayList<android.net.Uri> streamsVecchi(android.content.Intent i) { return i.getParcelableArrayListExtra(android.content.Intent.EXTRA_STREAM); }

    /** condivisi() → { uris: [...] } e li dimentica (la pagina li copia subito con PairWood.importa). */
    @PluginMethod
    public void condivisi(PluginCall call) {
        com.getcapacitor.JSArray a = new com.getcapacitor.JSArray();
        synchronized (condivisi) { for (String u : condivisi) a.put(u); condivisi.clear(); }
        call.resolve(new com.getcapacitor.JSObject().put("uris", a));
    }

    // ---------- tasto «Invia e ricevi» nella barra rapida ----------
    /** aggiungiTile() → { esito: 'aggiunto' | 'gia' | 'no' } oppure { manuale: true } (prima di Android 13: lo si mette a mano). */
    @PluginMethod
    public void aggiungiTile(PluginCall call) {
        if (android.os.Build.VERSION.SDK_INT < 33) { call.resolve(new com.getcapacitor.JSObject().put("manuale", true)); return; }
        android.app.StatusBarManager sb = getContext().getSystemService(android.app.StatusBarManager.class);
        sb.requestAddTileService(new android.content.ComponentName(getContext(), TileRicevi.class), "Invia e ricevi",
            android.graphics.drawable.Icon.createWithResource(getContext(), R.drawable.ic_tile_ricevi), getContext().getMainExecutor(), codice -> {
                String esito = codice == android.app.StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ADDED ? "aggiunto"
                    : codice == android.app.StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ALREADY_ADDED ? "gia" : "no";
                call.resolve(new com.getcapacitor.JSObject().put("esito", esito));
            });
    }

    // ---------- vibrazione (come DoctorWood) ----------
    /**
     * vibra({ tempi: [vibra, pausa, vibra, …] in ms, forza: 0,4–2,5 }): dove il telefono lo permette la forza regola
     * anche l'intensità del motore, così «Leggera» e «Forte» si sentono davvero diverse.
     */
    @PluginMethod
    public void vibra(PluginCall call) {
        try {
            org.json.JSONArray t = call.getArray("tempi");
            double forza = call.getDouble("forza", 1.0);
            if (t == null || t.length() == 0) { call.resolve(); return; }
            android.os.Vibrator v;
            if (android.os.Build.VERSION.SDK_INT >= 31) {
                android.os.VibratorManager vm = (android.os.VibratorManager) getContext().getSystemService(android.content.Context.VIBRATOR_MANAGER_SERVICE);
                v = vm != null ? vm.getDefaultVibrator() : null;
            } else v = vibratoreVecchio();
            if (v == null || !v.hasVibrator()) { call.resolve(); return; }
            int n = Math.min(t.length(), 20);
            long[] tempi = new long[n + 1];
            int[] ampiezze = new int[n + 1];
            int amp = (int) Math.round(Math.max(1, Math.min(255, 110 + (Math.max(0.4, Math.min(2.5, forza)) - 0.4) / 2.1 * 145)));
            for (int i = 0; i < n; i++) {
                tempi[i + 1] = Math.max(1, Math.min(1000, t.getLong(i)));
                ampiezze[i + 1] = i % 2 == 0 ? (v.hasAmplitudeControl() ? amp : android.os.VibrationEffect.DEFAULT_AMPLITUDE) : 0;
            }
            v.vibrate(android.os.VibrationEffect.createWaveform(tempi, ampiezze, -1));
            call.resolve();
        } catch (Exception e) {
            call.reject("Vibrazione non riuscita", "ERRORE", e);
        }
    }

    @SuppressWarnings("deprecation")
    private android.os.Vibrator vibratoreVecchio() { return (android.os.Vibrator) getContext().getSystemService(android.content.Context.VIBRATOR_SERVICE); }

    @Override
    public void load() {
        attivo = this;
        int p = getContext().getSharedPreferences(PREF, android.content.Context.MODE_PRIVATE).getInt("testo", 100);
        if (p != 100 && getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().getSettings().setTextZoom(p);
    }

    /** dimensioneTesto({ percento: 100 | 115 | 130 }): zoom del testo della WebView, ricordato anche alla riapertura. */
    @PluginMethod
    public void dimensioneTesto(PluginCall call) {
        Integer p = call.getInt("percento");
        if (p == null || (p != 100 && p != 115 && p != 130)) { call.reject("dimensione non valida"); return; }
        getContext().getSharedPreferences(PREF, android.content.Context.MODE_PRIVATE).edit().putInt("testo", p).apply();
        getActivity().runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().getSettings().setTextZoom(p);
            call.resolve();
        });
    }

    // ---------- blocco dell'app: impronta (o PIN / sequenza del telefono) ----------
    private int autenticatoriSblocco() {
        // impronta (o volto) forte; se non c'è, il PIN, la sequenza o la password del telefono
        return android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R
                ? androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG | androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
                : androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK | androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    }

    /** puoSbloccare() → { ok, impronta }: il telefono ha un blocco (impronta, PIN o sequenza) con cui verificare chi lo tiene. */
    @PluginMethod
    public void puoSbloccare(PluginCall call) {
        androidx.biometric.BiometricManager bm = androidx.biometric.BiometricManager.from(getContext());
        call.resolve(new com.getcapacitor.JSObject()
            .put("ok", bm.canAuthenticate(autenticatoriSblocco()) == androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS)
            .put("impronta", bm.canAuthenticate(androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG) == androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS));
    }

    /** verificaIdentita({ titolo?, sottotitolo? }): impronta, oppure PIN / sequenza del telefono. Rifiuta con «ANNULLATO» o «ERRORE». */
    @PluginMethod
    public void verificaIdentita(PluginCall call) {
        String titolo = call.getString("titolo", "BothWise");
        String sottotitolo = call.getString("sottotitolo", "Sblocca per continuare");
        android.app.Activity a = getActivity();
        a.runOnUiThread(() -> {
            try {
                androidx.biometric.BiometricPrompt.PromptInfo info = new androidx.biometric.BiometricPrompt.PromptInfo.Builder()
                        .setTitle(titolo).setSubtitle(sottotitolo)
                        .setAllowedAuthenticators(autenticatoriSblocco())
                        .setConfirmationRequired(false).build();
                new androidx.biometric.BiometricPrompt((androidx.fragment.app.FragmentActivity) a, androidx.core.content.ContextCompat.getMainExecutor(a),
                    new androidx.biometric.BiometricPrompt.AuthenticationCallback() {
                        @Override public void onAuthenticationSucceeded(androidx.biometric.BiometricPrompt.AuthenticationResult r) { call.resolve(); }
                        @Override public void onAuthenticationError(int codice, CharSequence msg) {
                            boolean annullato = codice == androidx.biometric.BiometricPrompt.ERROR_USER_CANCELED || codice == androidx.biometric.BiometricPrompt.ERROR_CANCELED
                                || codice == androidx.biometric.BiometricPrompt.ERROR_NEGATIVE_BUTTON;
                            call.reject(String.valueOf(msg), annullato ? "ANNULLATO" : "ERRORE");
                        }
                    }).authenticate(info);
            } catch (Exception e) { call.reject("Sblocco non disponibile: " + e.getMessage(), "ERRORE", e); }
        });
    }
    /** barre({ chiaro, colore }) — barra di stato e barra in basso dello stesso colore dell'intestazione della pagina,
     *  con icone scure sul tema chiaro e chiare sul tema scuro (così l'ora si vede sempre) */
    @PluginMethod
    public void barre(PluginCall call) {
        final boolean chiaro = Boolean.TRUE.equals(call.getBoolean("chiaro", false));
        String c = call.getString("colore", "");
        int colore;
        try { colore = android.graphics.Color.parseColor(c != null && c.matches("#[0-9a-fA-F]{6}") ? c : (chiaro ? "#ffffff" : "#1e293b")); }
        catch (Exception e) { colore = chiaro ? 0xffffffff : 0xff1e293b; }
        final int col = colore;
        getActivity().runOnUiThread(() -> {
            android.view.Window w = getActivity().getWindow();
            w.getDecorView().setBackgroundColor(col);
            //noinspection deprecation
            w.setStatusBarColor(col);
            //noinspection deprecation
            w.setNavigationBarColor(col);
            androidx.core.view.WindowInsetsControllerCompat ic = androidx.core.view.WindowCompat.getInsetsController(w, w.getDecorView());
            ic.setAppearanceLightStatusBars(chiaro);
            ic.setAppearanceLightNavigationBars(chiaro);
            call.resolve();
        });
    }

    /** apriLink({ url }) — apre nel browser solo la pagina per sostenere l'app (Ko-fi) o GitHub; nient'altro */
    @PluginMethod
    public void apriLink(PluginCall call) {
        String u = call.getString("url", "");
        android.net.Uri x = android.net.Uri.parse(u == null ? "" : u);
        String h = x.getHost() == null ? "" : x.getHost().toLowerCase(java.util.Locale.ROOT);
        if (!"https".equals(x.getScheme()) || !(h.equals("ko-fi.com") || h.equals("github.com"))) { call.reject("Indirizzo non ammesso", "DATI"); return; }
        try { getActivity().startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, x).addCategory(android.content.Intent.CATEGORY_BROWSABLE)); call.resolve(); }
        catch (android.content.ActivityNotFoundException e) { call.reject("Nessun browser", "ASSENTE", e); }
    }

    // ===================== AGGIORNAMENTI DA GITHUB =====================
    // Fuori dal Play Store: la pagina chiede (una volta a settimana o con «Controlla adesso») se c'è una versione nuova.
    // Il lavoro di rete è tutto qui, non nella pagina (che resta senza internet). Vedi Aggiornamento.java per i controlli.
    private Aggiornamento.Info ultimaTrovata;
    private java.io.File apkPronto;

    /** controllaAggiornamento() → { installata, nuova, versione?, novita?, dimensione? } */
    @PluginMethod
    public void controllaAggiornamento(PluginCall call) {
        new Thread(() -> {
            try {
                android.content.Context c = getContext();
                long mia = Aggiornamento.versioneInstallata(c);
                Aggiornamento.Info x = Aggiornamento.ultima(c);
                com.getcapacitor.JSObject r = new com.getcapacitor.JSObject();
                r.put("installata", mia);
                boolean nuova = x != null && x.versionCode > mia;
                r.put("nuova", nuova);
                if (nuova) { ultimaTrovata = x; r.put("versione", x.versione); r.put("novita", x.novita); r.put("dimensione", x.dimensione); }
                else Aggiornamento.pulisci(c);
                call.resolve(r);
            } catch (Exception e) { call.reject(messaggioAgg(e, "Non riesco a controllare: sei collegato a internet?")); }
        }, "aggiornamento").start();
    }

    /** scaricaAggiornamento() → scarica, controlla e apre l'installazione di Android (che chiede la conferma). Avanzamento: evento «aggiornamento» { percento } */
    @PluginMethod
    public void scaricaAggiornamento(PluginCall call) {
        final Aggiornamento.Info x = ultimaTrovata;
        if (x == null) { call.reject("Prima controlla se c'è una versione nuova"); return; }
        new Thread(() -> {
            try {
                apkPronto = Aggiornamento.scaricaEVerifica(getContext(), x, p -> { com.getcapacitor.JSObject e = new com.getcapacitor.JSObject(); e.put("percento", p); notifyListeners("aggiornamento", e); });
                getActivity().runOnUiThread(() -> installaOPermesso(call));
            } catch (SecurityException e) { call.reject(messaggioAgg(e, "File non valido"), "FIRMA"); }
            catch (Exception e) { call.reject(messaggioAgg(e, "Download non riuscito: riprova più tardi.")); }
        }, "aggiornamento").start();
    }

    private void installaOPermesso(PluginCall call) {
        if (!getContext().getPackageManager().canRequestPackageInstalls()) {
            // la prima volta Android chiede di permettere a BothWise di installare app: si torna qui da soli
            android.content.Intent i = new android.content.Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, android.net.Uri.parse("package:" + getContext().getPackageName()));
            startActivityForResult(call, i, "dopoPermessoInstallazione");
            return;
        }
        installaApk(call);
    }

    @ActivityCallback
    private void dopoPermessoInstallazione(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (call == null) return;
        if (!getContext().getPackageManager().canRequestPackageInstalls()) { com.getcapacitor.JSObject r = new com.getcapacitor.JSObject(); r.put("permesso", false); call.resolve(r); return; }
        installaApk(call);
    }

    private void installaApk(PluginCall call) {
        java.io.File f = apkPronto;
        if (f == null || !f.isFile()) { call.reject("Il file non c'è più: tocca di nuovo Aggiorna"); return; }
        try {
            android.net.Uri u = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_VIEW).setDataAndType(u, "application/vnd.android.package-archive")
                .addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION | android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            com.getcapacitor.JSObject r = new com.getcapacitor.JSObject(); r.put("permesso", true); r.put("avviata", true); call.resolve(r);
        } catch (Exception e) { call.reject(messaggioAgg(e, "Non riesco ad aprire l'installazione")); }
    }

    private static String messaggioAgg(Exception e, String predefinito) {
        String m = e.getMessage();
        return m == null || m.isEmpty() || m.length() > 160 || e instanceof java.net.UnknownHostException || e instanceof java.net.SocketTimeoutException ? predefinito : m;
    }
}
