// Toteat FALSO para probar la sincronización: responde a GET /sales con la forma documentada.
import http from 'node:http';

const iso = (ms) => new Date(ms).toISOString().slice(0, 19);
const t = Date.now();
const calls = [];

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__calls') { res.end(JSON.stringify(calls)); return; }
  calls.push(u.search);
  if (u.pathname !== '/sales' || u.searchParams.get('xapitoken') !== 'token-falso') {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, msg: 'bad' }));
    return;
  }
  const mk = (id, payed, phone, name, products) => ({
    paymentId: id, orderId: id + 1, payed, total: payed, gratuity: 0, fiscalType: 'BE',
    paymentForms: [{ id: 3000, name: 'Tarjeta Débito', amount: payed }], products,
    dateOpen: iso(t - 120000), dateClosed: iso(t - 60000),
    client: { firstName: name, phones: [phone], lastName: '', email: '' }
  });
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    ok: true, msg: { texto: 'SALES SENT' },
    data: [
      mk(900001, 44000, '3151234567', 'Laura', [{ id: 'C1', name: 'Combo Burger Doble', payed: 44000, quantity: 1 }]),
      mk(900002, 24900, '3151234567', 'Laura', [{ id: 'B1', name: 'Burger sencilla', payed: 24900, quantity: 1 }])
    ]
  }));
}).listen(8791, () => console.log('toteat falso en 8791'));
