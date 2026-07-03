# FIDELIZATE — Diseno de contabilidad y automatizaciones en GHL

Como llevar el conteo de compras y disparar recordatorios por fase, sin que los
contactos queden atrapados en flujos viejos. Aplica por subcuenta de GHL (un set de
campos/etiquetas/workflows por negocio cliente).

---

## Principio rector: FIDELIZATE manda valores absolutos

FIDELIZATE es la fuente de verdad. En cada compra envia al webhook los **valores
absolutos** (no "suma 1"). GHL solo guarda y reacciona. Esto elimina desincronizacion
y hace que cualquier reproceso sea idempotente (reenviar el mismo evento no rompe nada).

### Dos dimensiones independientes
1. **Progreso** (cuantos sellos lleva): la calcula FIDELIZATE y la envia. Sirve para
   "te falta 1 para el premio", "premio listo", etc.
2. **Recencia** (dias sin comprar): la maneja GHL con timers anclados a la fecha de
   ultima compra, que se reinician en cada compra nueva. Sirve para "hace 15 dias que
   no vienes", "te extranamos (30d)", "descuento (60d)".

No mezclar ambas en un solo campo. Cada una tiene su mecanismo.

---

## 1. Campos personalizados en GHL (los crea cada subcuenta)

| Campo (key)             | Tipo          | Lo setea            | Para que sirve |
|-------------------------|---------------|---------------------|----------------|
| `loyalty_stamps`        | Number        | FIDELIZATE          | Sellos en la tarjeta actual (0..rewardAt) |
| `loyalty_total`         | Number        | FIDELIZATE          | Compras historicas totales (lifetime) |
| `loyalty_to_reward`     | Number        | FIDELIZATE          | Sellos que faltan para el premio |
| `loyalty_reward_ready`  | Checkbox/Bool | FIDELIZATE          | true cuando se completo la tarjeta |
| `loyalty_last_purchase` | Date          | FIDELIZATE          | Fecha de la ultima compra (ancla de recencia) |
| `loyalty_stage`         | Single select | FIDELIZATE (progreso) | Etapa de progreso actual (ver seccion 3) |
| `rut`                   | Text          | FIDELIZATE          | RUT del cliente (identificador externo) |

`loyalty_to_reward` lo manda FIDELIZATE ya calculado (`rewardAt - loyalty_stamps`)
para no obligar a GHL a hacer matematica.

---

## 2. Identificacion del contacto y alta automatica

El webhook trae `rut`, `name`, `email`, `phone`. La automatizacion hace **Upsert
Contact** (crear si no existe, actualizar si existe), dedup por `phone` y/o `email`.
Si el cliente no tiene email ni telefono, GHL igual crea el contacto con lo que haya
(nombre + RUT en custom field); FIDELIZATE sigue siendo el registro maestro por RUT.

Recomendacion: pedir al menos telefono en la caja al crear un cliente nuevo, porque
es la mejor llave de dedup en GHL y el canal de WhatsApp depende de el.

---

## 3. Dimension PROGRESO: campo `loyalty_stage` + etiquetas limpias

FIDELIZATE calcula la etapa de progreso y la envia en el payload como `loyaltyStage`.
Valores sugeridos (con rewardAt = 10):

| `loyalty_stage` | Condicion                         | Uso tipico |
|-----------------|-----------------------------------|-----------|
| `NUEVO`         | `isNewCustomer` o `loyalty_total == 1` | bienvenida |
| `EN_PROGRESO`   | `1 < stamps` y `to_reward > 2`    | seguimiento normal |
| `CASI_PREMIO`   | `to_reward <= 2` y `to_reward > 0`| "te falta poco" + recordatorio semanal |
| `PREMIO_LISTO`  | `rewardTriggered` / `reward_ready`| avisar premio + tag `loyalty_reward_pending` |

### Como evitar que queden en dos etiquetas a la vez
Workflow **"Sync Etapa de Lealtad"**:
- Trigger: Contact Field Changed -> `loyalty_stage` (o `loyalty_stamps`).
- Accion 1: **Remove Tags** de todas las etiquetas de etapa
  (`lealtad-nuevo`, `lealtad-progreso`, `lealtad-casi`, `lealtad-premio`).
- Accion 2: **Add Tag** la que corresponde al `loyalty_stage` recibido.
- Accion 3 (opcional): enviar el mensaje de esa etapa.

Borron y cuenta nueva en cada update => nunca conviven dos etiquetas de etapa.
Las etiquetas son solo "espejo" del campo; la verdad esta en `loyalty_stage`.

### Recordatorio semanal "te falta poco"
Workflow **"Casi Premio"**:
- Trigger: tag `lealtad-casi` agregada.
- Loop: Wait 7 dias -> si sigue con `lealtad-casi` (no compro) -> enviar nudge ->
  repetir. Al comprar, el Sync Etapa quita `lealtad-casi` y el contacto sale del loop.

---

## 4. Dimension RECENCIA: timers que se reinician en cada compra

Workflow **"Inactividad / Reenganche"** (la magia de "sacar del flujo viejo y
recolocar"):
- Trigger: Contact Field Changed -> `loyalty_last_purchase`.
- **Setting clave**: activar "Allow Re-Entry". Y como primera accion del workflow de
  compra, ejecutar **Remove from Workflow: Inactividad** antes de re-disparar, para
  garantizar que el reloj arranca de cero.
- Secuencia anclada a la fecha:
  - Wait 15 dias -> mensaje "hace tiempo no te vemos".
  - Wait hasta 30 dias -> "te extranamos".
  - Wait hasta 60 dias -> cupon de descuento + tag `lealtad-en-riesgo`.
  - (Opcional) Wait hasta 90 dias -> tag `lealtad-perdido` para segmentar.

Cuando llega una compra nueva, `loyalty_last_purchase` cambia, el contacto se remueve
del flujo anterior y vuelve a entrar: los 15/30/60 dias se reinician solos. Eso es
exactamente "sacarlo del flujo anterior e ingresarlo a la numerologia correcta".

---

## 5. Resumen de quien calcula que

- **FIDELIZATE calcula y envia**: `loyalty_stamps`, `loyalty_total`,
  `loyalty_to_reward`, `loyalty_reward_ready`, `loyalty_last_purchase`,
  `loyalty_stage` (progreso), `isNewCustomer`.
- **GHL calcula con el tiempo**: la dimension de recencia (15/30/60/90 dias) via
  Wait steps anclados a `loyalty_last_purchase`, mas el manejo de etiquetas-espejo.

Asi FIDELIZATE no necesita cron de recencia y GHL no necesita logica de conteo.

---

## 6. Ideas de automatizaciones que esto habilita

- Primera compra -> bienvenida + como funciona la tarjeta.
- `to_reward == 1` -> "con tu proxima compra ganas el premio".
- `reward_ready` -> aviso de premio + recordatorio de canje a los 3 y 7 dias.
- Tras canjear premio (tarjeta reseteada) -> mensaje "empieza tu nueva tarjeta".
- 15 dias sin comprar -> recordatorio suave.
- 30 dias -> "te extranamos" + beneficio chico.
- 60 dias -> cupon de descuento de reactivacion.
- 90 dias -> a segmento "perdido" para campana aparte.
- Hito de `loyalty_total` (ej. 25, 50 compras) -> reconocimiento VIP / tag VIP.
