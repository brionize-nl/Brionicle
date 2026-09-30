const Windy = {
    map: null,
    overlay: null,
    visible: false,
    _onMove: null,
    _moveTimer: null,

    init(map) {
        this.map = map;
    },

    show() {
        if (this.visible) return;
        this.visible = true;

        this.overlay = document.createElement('div');
        this.overlay.id = 'windy-overlay';
        this.overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:500;pointer-events:auto;';

        const close = document.createElement('button');
        close.innerHTML = '&times; Sluit Windy';
        close.style.cssText = 'position:absolute;top:16px;right:16px;z-index:501;background:rgba(15,15,26,0.9);color:#fff;border:1px solid #4fc3f7;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;';
        close.addEventListener('click', () => {
            const cb = document.getElementById('layer-windy');
            if (cb) cb.checked = false;
            this.hide();
        });

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width:100%;height:100%;border:none;';
        iframe.src = this.buildUrl();
        iframe.allow = 'geolocation';

        this.overlay.appendChild(iframe);
        this.overlay.appendChild(close);
        document.body.appendChild(this.overlay);

        this._onMove = () => {
            if (this._moveTimer) clearTimeout(this._moveTimer);
            this._moveTimer = setTimeout(() => this.syncPosition(), 1500);
        };
        this.map.on('moveend', this._onMove);
    },

    hide() {
        this.visible = false;
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this._moveTimer) {
            clearTimeout(this._moveTimer);
            this._moveTimer = null;
        }
        if (this._onMove) {
            this.map.off('moveend', this._onMove);
            this._onMove = null;
        }
    },

    buildUrl() {
        const c = this.map.getCenter();
        const z = this.map.getZoom();
        return `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh&zoom=${z}&overlay=wind&product=ecmwf&level=surface&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&message=true`;
    },

    syncPosition() {
        if (!this.overlay || !this.visible) return;
        const iframe = this.overlay.querySelector('iframe');
        if (iframe) iframe.src = this.buildUrl();
    }
};
