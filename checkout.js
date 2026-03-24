// ================================================
//  CHECKOUT.JS — Flujo de pago completo
// ================================================

const checkout = {
  step: 1,          // 1=resumen, 2=envío, 3=pago, 4=confirmación
  method: 'card',   // 'card' | 'oxxo' | 'transfer'
  orderData: {},
  orderId: null,

  // ── Abrir modal ──────────────────────────────
  open() {
    if (!state.cart.length) {
      showToast('warning', '⚠️', 'Tu carrito está vacío');
      return;
    }
    this.step = 1;
    this.method = 'card';
    this.orderData = {};
    this.render();
    document.getElementById('checkout-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close() {
    if (this.step === 4) {
      // Si ya pagó, limpiar carrito al cerrar
      state.cart = [];
      DB.saveCart(state.cart);
      updateCartBadge();
      closePanel();
    }
    document.getElementById('checkout-modal').classList.remove('open');
    document.body.style.overflow = '';
  },

  // ── Totales ──────────────────────────────────
  getSubtotal() { return state.cart.reduce((s, i) => s + i.price * i.qty, 0); },
  getShipping()  {
    if (this.step >= 2 && this.orderData.shippingMethod === 'express') return 199;
    const sub = this.getSubtotal();
    return sub >= 999 ? 0 : 99;
  },
  getTax()    { return Math.round(this.getSubtotal() * 0.16); },
  getTotal()  { return this.getSubtotal() + this.getShipping() + this.getTax(); },

  // ── Navegación ───────────────────────────────
  next() {
    if (this.step === 1) { this.step = 2; this.render(); return; }
    if (this.step === 2) {
      if (!this.validateShipping()) return;
      this.step = 3; this.render(); return;
    }
    if (this.step === 3) {
      if (!this.validatePayment()) return;
      this.processPayment();
    }
  },

  back() {
    if (this.step > 1 && this.step < 4) { this.step--; this.render(); }
  },

  // ── Validaciones ─────────────────────────────
  validateShipping() {
    const fields = ['sh-name','sh-email','sh-phone','sh-address','sh-city','sh-zip','sh-state'];
    for (const id of fields) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (!el.value.trim()) {
        this.shake(el);
        showToast('error', '⚠️', 'Completa todos los campos de envío');
        el.focus();
        return false;
      }
    }
    // Email válido
    const email = document.getElementById('sh-email').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('error', '⚠️', 'Escribe un correo válido');
      document.getElementById('sh-email').focus();
      return false;
    }
    // Teléfono 10 dígitos
    const phone = document.getElementById('sh-phone').value.replace(/\D/g,'');
    if (phone.length < 10) {
      showToast('error', '⚠️', 'El teléfono debe tener 10 dígitos');
      document.getElementById('sh-phone').focus();
      return false;
    }
    // Guardar datos
    this.orderData.shipping = {
      name:    document.getElementById('sh-name').value.trim(),
      email:   document.getElementById('sh-email').value.trim(),
      phone:   document.getElementById('sh-phone').value.trim(),
      address: document.getElementById('sh-address').value.trim(),
      city:    document.getElementById('sh-city').value.trim(),
      zip:     document.getElementById('sh-zip').value.trim(),
      state:   document.getElementById('sh-state').value.trim(),
    };
    this.orderData.shippingMethod = document.querySelector('input[name="shipping-method"]:checked')?.value || 'standard';
    return true;
  },

  validatePayment() {
    if (this.method === 'card') {
      const number = document.getElementById('card-number').value.replace(/\s/g,'');
      const name   = document.getElementById('card-name').value.trim();
      const expiry = document.getElementById('card-expiry').value.trim();
      const cvv    = document.getElementById('card-cvv').value.trim();

      if (number.length < 16) {
        showToast('error','⚠️','Número de tarjeta inválido');
        document.getElementById('card-number').focus(); return false;
      }
      if (!name) {
        showToast('error','⚠️','Escribe el nombre del titular');
        document.getElementById('card-name').focus(); return false;
      }
      if (!/^\d{2}\/\d{2}$/.test(expiry) || !this.isValidExpiry(expiry)) {
        showToast('error','⚠️','Fecha de vencimiento inválida (MM/AA)');
        document.getElementById('card-expiry').focus(); return false;
      }
      if (cvv.length < 3) {
        showToast('error','⚠️','CVV inválido');
        document.getElementById('card-cvv').focus(); return false;
      }
      this.orderData.payment = { method:'card', last4: number.slice(-4), brand: this.detectBrand(number) };
    } else {
      this.orderData.payment = { method: this.method };
    }
    return true;
  },

  isValidExpiry(val) {
    const [mm, yy] = val.split('/').map(Number);
    if (mm < 1 || mm > 12) return false;
    const now = new Date();
    const exp = new Date(2000 + yy, mm - 1);
    return exp >= new Date(now.getFullYear(), now.getMonth());
  },

  detectBrand(num) {
    if (/^4/.test(num))      return 'Visa';
    if (/^5[1-5]/.test(num)) return 'Mastercard';
    if (/^3[47]/.test(num))  return 'Amex';
    return 'Tarjeta';
  },

  // ── Simular pago ─────────────────────────────
  processPayment() {
    const btn = document.getElementById('checkout-pay-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="co-spinner"></span> Procesando...';
    }
    // Simula latencia de API de pago
    setTimeout(() => {
      const success = Math.random() > 0.05; // 95% éxito
      if (success) {
        this.orderId = 'TS-' + Date.now().toString().slice(-6).toUpperCase();
        // Guardar en historial
        const orders = DB.getOrders();
        orders.unshift({
          id:       this.orderId,
          date:     new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }),
          items:    [...state.cart],
          shipping: this.orderData.shipping,
          payment:  this.orderData.payment,
          total:    this.getTotal(),
          status:   'pending'
        });
        DB.saveOrders(orders);
        // Actualizar usuario
        if (state.user) { state.user.orders = (state.user.orders || 0) + 1; DB.saveUser(state.user); }
        this.step = 4;
        this.render();
        addNotification('📦', `Pedido ${this.orderId} confirmado. Te contactaremos pronto.`);
      } else {
        if (btn) { btn.disabled = false; btn.innerHTML = '🔒 Pagar $' + this.getTotal().toLocaleString(); }
        showToast('error','❌','El pago fue rechazado. Verifica tus datos.');
      }
    }, 1800);
  },

  shake(el) {
    el.style.animation = 'shake 0.4s ease';
    el.style.borderColor = 'var(--danger)';
    setTimeout(() => { el.style.animation = ''; el.style.borderColor = ''; }, 500);
  },

  // ── Render principal ─────────────────────────
  render() {
    this.renderSteps();
    this.renderBody();
    this.renderFooter();
  },

  renderSteps() {
    const steps = [
      { n:1, label:'Resumen' },
      { n:2, label:'Envío'   },
      { n:3, label:'Pago'    },
      { n:4, label:'Listo'   },
    ];
    document.getElementById('co-steps').innerHTML = steps.map(s => `
      <div class="co-step ${s.n < this.step ? 'done' : ''} ${s.n === this.step ? 'active' : ''}">
        <div class="co-step-dot">${s.n < this.step ? '✓' : s.n}</div>
        <span class="co-step-label">${s.label}</span>
      </div>
      ${s.n < 4 ? '<div class="co-step-line ' + (s.n < this.step ? 'done' : '') + '"></div>' : ''}`
    ).join('');
  },

  renderBody() {
    const body = document.getElementById('co-body');
    if (this.step === 1) body.innerHTML = this.tmplSummary();
    if (this.step === 2) body.innerHTML = this.tmplShipping();
    if (this.step === 3) body.innerHTML = this.tmplPayment();
    if (this.step === 4) body.innerHTML = this.tmplSuccess();

    if (this.step === 3) this.bindCardInputs();
    if (this.step === 2) this.restoreShipping();
  },

  renderFooter() {
    const footer = document.getElementById('co-footer');
    if (this.step === 4) { footer.innerHTML = `<button class="co-btn-ghost" onclick="checkout.close()">Cerrar y continuar comprando</button>`; return; }

    const backBtn  = this.step > 1 ? `<button class="co-btn-ghost" onclick="checkout.back()">← Atrás</button>` : `<button class="co-btn-ghost" onclick="checkout.close()">Cancelar</button>`;
    const nextLabel = this.step === 3
      ? `🔒 Pagar $${this.getTotal().toLocaleString()}`
      : this.step === 2 ? 'Continuar al pago →' : 'Continuar →';
    const nextId = this.step === 3 ? 'id="checkout-pay-btn"' : '';

    footer.innerHTML = `
      <div class="co-footer-totals">
        <span>Total a pagar</span>
        <strong>$${this.getTotal().toLocaleString()}</strong>
      </div>
      <div class="co-footer-btns">
        ${backBtn}
        <button class="co-btn-primary" ${nextId} onclick="checkout.next()">${nextLabel}</button>
      </div>`;
  },

  // ── Templates ────────────────────────────────
  tmplSummary() {
    const sub      = this.getSubtotal();
    const shipping = this.getShipping();
    const tax      = this.getTax();
    const total    = this.getTotal();

    return `
      <div class="co-section-title">Resumen de tu pedido</div>
      <div class="co-items">
        ${state.cart.map(i => `
          <div class="co-item">
            <span class="co-item-emoji">${i.emoji}</span>
            <div class="co-item-info">
              <div class="co-item-name">${i.name}</div>
              <div class="co-item-qty">Cantidad: ${i.qty}</div>
            </div>
            <div class="co-item-price">$${(i.price * i.qty).toLocaleString()}</div>
          </div>`).join('')}
      </div>
      <div class="co-totals">
        <div class="co-total-row"><span>Subtotal</span><span>$${sub.toLocaleString()}</span></div>
        <div class="co-total-row"><span>Envío</span><span>${shipping === 0 ? '<span style="color:var(--success)">Gratis</span>' : '$' + shipping}</span></div>
        <div class="co-total-row"><span>IVA (16%)</span><span>$${tax.toLocaleString()}</span></div>
        <div class="co-total-row total"><span>Total</span><span>$${total.toLocaleString()}</span></div>
      </div>
      ${sub < 999 ? '<div class="co-tip">🚚 Agrega $' + (999 - sub).toLocaleString() + ' más para envío gratis</div>' : '<div class="co-tip success">🎉 ¡Tienes envío gratis!</div>'}`;
  },

  tmplShipping() {
    return `
      <div class="co-section-title">Datos de envío</div>
      <div class="co-form">
        <div class="co-form-row">
          <div class="co-field">
            <label>Nombre completo *</label>
            <input class="form-control" id="sh-name" type="text" placeholder="Tu nombre completo" autocomplete="name">
          </div>
        </div>
        <div class="co-form-row-2">
          <div class="co-field">
            <label>Correo electrónico *</label>
            <input class="form-control" id="sh-email" type="email" placeholder="tu@email.com" autocomplete="email">
          </div>
          <div class="co-field">
            <label>Teléfono *</label>
            <input class="form-control" id="sh-phone" type="tel" placeholder="5512345678" autocomplete="tel" maxlength="10" oninput="this.value=this.value.replace(/\D/g,'')">
          </div>
        </div>
        <div class="co-field">
          <label>Dirección *</label>
          <input class="form-control" id="sh-address" type="text" placeholder="Calle, número, colonia" autocomplete="street-address">
        </div>
        <div class="co-form-row-2">
          <div class="co-field">
            <label>Ciudad *</label>
            <input class="form-control" id="sh-city" type="text" placeholder="Ciudad de México" autocomplete="address-level2">
          </div>
          <div class="co-field">
            <label>Código postal *</label>
            <input class="form-control" id="sh-zip" type="text" placeholder="06600" maxlength="5" autocomplete="postal-code" oninput="this.value=this.value.replace(/\D/g,'')">
          </div>
        </div>
        <div class="co-field">
          <label>Estado *</label>
          <select class="form-control" id="sh-state" autocomplete="address-level1">
            <option value="">Seleccionar estado...</option>
            ${['Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'].map(s => `<option>${s}</option>`).join('')}
          </select>
        </div>

        <div class="co-section-title" style="margin-top:16px">Método de envío</div>
        <div class="co-shipping-methods">
          <label class="co-method-card">
            <input type="radio" name="shipping-method" value="standard" checked>
            <div class="co-method-body">
              <div class="co-method-name">📦 Estándar</div>
              <div class="co-method-desc">3–5 días hábiles</div>
            </div>
            <div class="co-method-price">${this.getSubtotal() >= 999 ? '<span style="color:var(--success)">Gratis</span>' : '$99'}</div>
          </label>
          <label class="co-method-card">
            <input type="radio" name="shipping-method" value="express">
            <div class="co-method-body">
              <div class="co-method-name">⚡ Express</div>
              <div class="co-method-desc">1–2 días hábiles</div>
            </div>
            <div class="co-method-price">$199</div>
          </label>
        </div>
      </div>`;
  },

  tmplPayment() {
    return `
      <div class="co-section-title">Método de pago</div>

      <div class="co-pay-tabs">
        <button class="co-pay-tab ${this.method==='card'?'active':''}"       onclick="checkout.setMethod('card')">💳 Tarjeta</button>
        <button class="co-pay-tab ${this.method==='oxxo'?'active':''}"       onclick="checkout.setMethod('oxxo')">🏪 OXXO</button>
        <button class="co-pay-tab ${this.method==='transfer'?'active':''}"   onclick="checkout.setMethod('transfer')">🏦 Transferencia</button>
      </div>

      <div id="co-pay-content">
        ${this.tmplPayContent()}
      </div>

      <div class="co-order-review">
        <div class="co-section-title" style="margin-bottom:10px">Confirma tu pedido</div>
        ${state.cart.slice(0,3).map(i => `<div class="co-mini-item"><span>${i.emoji}</span><span>${i.name}</span><span>×${i.qty}</span><span>$${(i.price*i.qty).toLocaleString()}</span></div>`).join('')}
        ${state.cart.length > 3 ? `<div style="font-size:12px;color:var(--c5);margin-top:4px">+${state.cart.length-3} artículos más</div>` : ''}
        <div class="co-mini-total"><span>Total con IVA</span><strong>$${this.getTotal().toLocaleString()}</strong></div>
      </div>

      <div class="co-secure-note">🔒 Pago 100% seguro · Tus datos están protegidos y encriptados</div>`;
  },

  tmplPayContent() {
    if (this.method === 'card') return `
      <div class="co-card-preview" id="card-preview">
        <div class="co-card-inner">
          <div class="co-card-front">
            <div class="co-card-brand" id="card-brand-logo">💳</div>
            <div class="co-card-chip">▬</div>
            <div class="co-card-num" id="card-num-display">•••• •••• •••• ••••</div>
            <div class="co-card-bottom">
              <div><div class="co-card-label">Titular</div><div class="co-card-val" id="card-name-display">NOMBRE APELLIDO</div></div>
              <div><div class="co-card-label">Vence</div><div class="co-card-val" id="card-exp-display">MM/AA</div></div>
            </div>
          </div>
        </div>
      </div>
      <div class="co-form" style="margin-top:14px">
        <div class="co-field">
          <label>Número de tarjeta *</label>
          <div style="position:relative">
            <input class="form-control" id="card-number" type="text" inputmode="numeric" placeholder="1234 5678 9012 3456" maxlength="19" autocomplete="cc-number">
            <span id="card-brand-badge" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:20px">💳</span>
          </div>
        </div>
        <div class="co-field">
          <label>Nombre del titular *</label>
          <input class="form-control" id="card-name" type="text" placeholder="COMO APARECE EN LA TARJETA" autocomplete="cc-name" style="text-transform:uppercase">
        </div>
        <div class="co-form-row-2">
          <div class="co-field">
            <label>Vencimiento (MM/AA) *</label>
            <input class="form-control" id="card-expiry" type="text" inputmode="numeric" placeholder="MM/AA" maxlength="5" autocomplete="cc-exp">
          </div>
          <div class="co-field">
            <label>CVV *</label>
            <div style="position:relative">
              <input class="form-control" id="card-cvv" type="password" inputmode="numeric" placeholder="•••" maxlength="4" autocomplete="cc-csc">
              <span title="3 dígitos al reverso de tu tarjeta" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:14px;cursor:help;color:var(--c5)">❓</span>
            </div>
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--c5);cursor:pointer;margin-top:4px">
          <input type="checkbox" id="save-card" style="accent-color:var(--accent)">
          Guardar tarjeta para futuras compras
        </label>
      </div>`;

    if (this.method === 'oxxo') return `
      <div class="co-alt-method">
        <div style="font-size:48px;margin-bottom:10px">🏪</div>
        <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Pago en OXXO</h3>
        <p style="font-size:13px;color:var(--c5);line-height:1.6;margin-bottom:14px">
          Al confirmar, recibirás una referencia de pago en tu correo. Tienes <strong>48 horas</strong> para realizar el pago en cualquier tienda OXXO del país.
        </p>
        <div class="co-oxxo-ref">
          <div style="font-size:11px;color:var(--c5);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Referencia de ejemplo</div>
          <div style="font-size:22px;font-weight:700;letter-spacing:4px;color:#fff">8899 1234 5678</div>
        </div>
        <ul style="font-size:12px;color:var(--c5);line-height:1.8;margin-top:14px;text-align:left">
          <li>✓ Sin cargo adicional</li>
          <li>✓ Tu pedido se activa al confirmar el pago</li>
          <li>✓ Comisión OXXO: $13 cobrada por la tienda</li>
        </ul>
      </div>`;

    return `
      <div class="co-alt-method">
        <div style="font-size:48px;margin-bottom:10px">🏦</div>
        <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Transferencia bancaria</h3>
        <p style="font-size:13px;color:var(--c5);line-height:1.6;margin-bottom:14px">
          Realiza tu transferencia a los datos siguientes. Envía el comprobante a <strong>pagos@techshop.com</strong>.
        </p>
        <div class="co-bank-data">
          <div class="co-bank-row"><span>Banco</span><strong>BBVA México</strong></div>
          <div class="co-bank-row"><span>Beneficiario</span><strong>TechShop SA de CV</strong></div>
          <div class="co-bank-row"><span>CLABE</span><strong>012 180 0012345678 90</strong></div>
          <div class="co-bank-row"><span>Cuenta</span><strong>0012345678</strong></div>
          <div class="co-bank-row"><span>Monto</span><strong style="color:var(--accent)">$${this.getTotal().toLocaleString()} MXN</strong></div>
        </div>
        <p style="font-size:12px;color:var(--c5);margin-top:12px">⚠️ El pedido se procesa en 1-2 días hábiles tras confirmar el pago.</p>
      </div>`;
  },

  tmplSuccess() {
    const o = this.orderData;
    const payLabel = o.payment?.method === 'card'
      ? `${o.payment.brand} ···· ${o.payment.last4}`
      : o.payment?.method === 'oxxo' ? 'OXXO' : 'Transferencia';
    return `
      <div class="co-success">
        <div class="co-success-icon">🎉</div>
        <h2 class="co-success-title">¡Pedido confirmado!</h2>
        <p class="co-success-sub">Gracias por tu compra. Te enviaremos actualizaciones a tu correo.</p>
        <div class="co-success-id">Pedido: <strong>${this.orderId}</strong></div>

        <div class="co-receipt">
          <div class="co-receipt-row"><span>📧 Correo</span><span>${o.shipping?.email || '—'}</span></div>
          <div class="co-receipt-row"><span>📦 Envío a</span><span>${o.shipping?.city || '—'}, ${o.shipping?.state || ''}</span></div>
          <div class="co-receipt-row"><span>💳 Pago</span><span>${payLabel}</span></div>
          <div class="co-receipt-row"><span>🚚 Entrega</span><span>${o.shippingMethod === 'express' ? '1–2 días hábiles' : '3–5 días hábiles'}</span></div>
          <div class="co-receipt-row total"><span>Total pagado</span><span>$${this.getTotal().toLocaleString()} MXN</span></div>
        </div>
      </div>`;
  },

  // ── Helpers ──────────────────────────────────
  setMethod(m) {
    this.method = m;
    document.querySelectorAll('.co-pay-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.co-pay-tab').forEach(b => { if (b.textContent.toLowerCase().includes(m === 'card' ? 'tarj' : m === 'oxxo' ? 'oxxo' : 'trans')) b.classList.add('active'); });
    document.getElementById('co-pay-content').innerHTML = this.tmplPayContent();
    if (m === 'card') this.bindCardInputs();
    // Actualizar botón con total
    const btn = document.getElementById('checkout-pay-btn');
    if (btn) btn.innerHTML = `🔒 Pagar $${this.getTotal().toLocaleString()}`;
  },

  bindCardInputs() {
    const numEl  = document.getElementById('card-number');
    const nameEl = document.getElementById('card-name');
    const expEl  = document.getElementById('card-expiry');

    if (numEl) {
      numEl.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g,'').slice(0,16);
        e.target.value = v.replace(/(\d{4})/g,'$1 ').trim();
        const display = document.getElementById('card-num-display');
        const badge   = document.getElementById('card-brand-badge');
        const logo    = document.getElementById('card-brand-logo');
        if (display) display.textContent = (v + '················').slice(0,16).replace(/(\d{4})/g,'$1 ').trim();
        const brand = this.detectBrand(v);
        const icons = { Visa:'💳', Mastercard:'🟠', Amex:'🔵' };
        const icon  = icons[brand] || '💳';
        if (badge) badge.textContent = icon;
        if (logo)  logo.textContent  = icon;
      });
    }
    if (nameEl) {
      nameEl.addEventListener('input', e => {
        e.target.value = e.target.value.toUpperCase();
        const d = document.getElementById('card-name-display');
        if (d) d.textContent = e.target.value || 'NOMBRE APELLIDO';
      });
    }
    if (expEl) {
      expEl.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g,'');
        if (v.length >= 2) v = v.slice(0,2) + '/' + v.slice(2,4);
        e.target.value = v;
        const d = document.getElementById('card-exp-display');
        if (d) d.textContent = v || 'MM/AA';
      });
    }
  },

  restoreShipping() {
    if (!this.orderData.shipping) return;
    const s = this.orderData.shipping;
    const map = { 'sh-name':s.name,'sh-email':s.email,'sh-phone':s.phone,'sh-address':s.address,'sh-city':s.city,'sh-zip':s.zip,'sh-state':s.state };
    Object.entries(map).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  }
};

// Extender DB con pedidos
DB.getOrders  = ()  => { try { const r = localStorage.getItem('ts_orders'); return r ? JSON.parse(r) : []; } catch { return []; } };
DB.saveOrders = (o) => localStorage.setItem('ts_orders', JSON.stringify(o));