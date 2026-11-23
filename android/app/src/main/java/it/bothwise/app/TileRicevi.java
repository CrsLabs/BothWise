package it.bothwise.app;

import android.annotation.SuppressLint;
import android.graphics.drawable.Icon;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

import java.text.DateFormat;
import java.util.Date;

import pairwood.sdk.AscoltoContinuo;

/**
 * Il tasto «Invia e ricevi» della barra rapida di Android (come AirDrop): un tocco apre la ricezione per 10 minuti, anche con
 * l'app chiusa (servizio in primo piano con notifica e «Spegni»), e apre il pannello per mandare un file a un dispositivo. Si spegne da sola.
 * Ricevono solo i file mandati da dispositivi già abbinati.
 */
public class TileRicevi extends TileService {
    private static final int MINUTI = 10;

    @Override public void onStartListening() { aggiorna(); }

    /** Un tocco accende la ricezione (10 minuti) e apre BothWise sul pannello «Invia e ricevi»: da lì si manda un file a un dispositivo o si spegne. */
    @SuppressLint("StartActivityAndCollapseDeprecated")   // sotto Android 14 esiste solo la forma con Intent
    @Override public void onClick() {
        if (AscoltoContinuo.ricezione(this) == null) AscoltoContinuo.apriRicezione(this, getPackageName(), MINUTI);
        aggiorna();
        final android.content.Intent i = new android.content.Intent(this, MainActivity.class)
            .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(BothWisePlugin.EXTRA_INVIA_RICEVI, true);
        unlockAndRun(() -> {
            if (android.os.Build.VERSION.SDK_INT >= 34) {
                startActivityAndCollapse(android.app.PendingIntent.getActivity(this, 7, i,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE));
            } else {
                startActivityAndCollapse(i);
            }
        });
    }

    private void aggiorna() {
        Tile t = getQsTile();
        if (t == null) return;
        kotlin.Pair<String, Long> r = AscoltoContinuo.ricezione(this);
        t.setLabel("Invia e ricevi");
        t.setIcon(Icon.createWithResource(this, R.drawable.ic_tile_ricevi));
        t.setState(r != null ? Tile.STATE_ACTIVE : Tile.STATE_INACTIVE);
        t.setSubtitle(r != null ? "Fino alle " + DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(r.getSecond())) : "Spento");
        t.updateTile();
    }
}
