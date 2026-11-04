import { requireCtx } from "@/lib/auth";
import { all, hasModule } from "@/lib/db";
import { ORDER_STATUSES, activeProducts, type Product } from "@/lib/commerce";
import ActionForm from "@/components/ActionForm";
import Modal from "@/components/Modal";
import Tabs from "@/components/Tabs";
import { Icon } from "@/components/icons";
import { Empty, Field, Locked, PageHeader } from "@/components/ui";
import { addProductAction, orderStatusAction, toggleProductAction, walkInOrderAction } from "../actions";

export default async function Orders({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { tenant: t } = await requireCtx();
  if (!hasModule(t, "commerce")) return <><PageHeader title="Orders" /><Locked title="Orders & products is switched off" href="/business-setup" cta="Open Business setup">Turn it on so your AI can show a catalog and take orders in chat.</Locked></>;
  const sp = await searchParams;
  const orders = all<{ id: number; phone: string; name: string; items: string; total: number | null; status: string; paid: number; created_at: string }>("SELECT * FROM orders WHERE tenant_id=? ORDER BY id DESC LIMIT 100", t.id);
  const products = all<Product>("SELECT * FROM products WHERE tenant_id=? ORDER BY id", t.id), live = activeProducts(t.id);
  const orderTab = (
    <div className="card"><div className="scroll" style={{ maxHeight: "calc(100vh - 250px)" }}>
      <table className="tbl"><thead><tr><th>#</th><th>Customer</th><th>Items</th><th>Total</th><th colSpan={3}>Status &amp; payment</th></tr></thead><tbody>
        {orders.map((o) => (
          <tr key={o.id}><td className="num strong">{o.id}</td><td><b>{o.name || "-"}</b><div className="tiny muted">{o.phone}</div></td>
            <td className="sm">{(JSON.parse(o.items) as { name: string; qty: number }[]).map((i) => `${i.qty}× ${i.name}`).join(", ")}</td><td className="num">{o.total ?? <span className="muted">to quote</span>}</td>
            <td colSpan={3}><ActionForm action={orderStatusAction} className="row" success="Order updated"><input type="hidden" name="id" value={o.id} />
              <select name="status" defaultValue={o.status} style={{ width: 130, height: 32 }}>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
              <label className="row sm" style={{ gap: 5 }}><input type="checkbox" name="paid" defaultChecked={!!o.paid} /> paid</label><button className="btn ghost s">Save</button></ActionForm></td></tr>))}
      </tbody></table>
      {!orders.length && <Empty icon="bag" title="No orders yet">Orders from WhatsApp, your page and the widget land here.</Empty>}
    </div></div>
  );
  const catalog = (
    <div className="card"><div className="card-h"><h3>What you sell</h3><span className="muted sm">Blank price = quote case by case · blank stock = made to order</span></div>
      <table className="tbl"><thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Visible</th><th /></tr></thead><tbody>
        {products.map((p) => (
          <tr key={p.id}><td><b>{p.name}</b></td><td className="num">{p.price ?? <span className="muted">on request</span>}</td><td className="num">{p.stock ?? <span className="muted">made to order</span>}</td><td>{p.active ? <span className="badge ok plain">Live</span> : <span className="badge plain">Hidden</span>}</td>
            <td><ActionForm action={toggleProductAction} success="Updated"><input type="hidden" name="id" value={p.id} /><button className="btn ghost s">{p.active ? "Hide" : "Show"}</button></ActionForm></td></tr>))}
      </tbody></table>
      {!products.length && <Empty icon="tag" title="No products yet">Add what you sell so your AI can take orders.</Empty>}
    </div>
  );
  return (
    <>
      <PageHeader title="Orders" sub="Everything customers have ordered, and the catalog your AI sells from.">
        <Modal title="Add product" trigger={<button className="btn ghost"><Icon n="tag" className="sm" /> Add product</button>}>
          <ActionForm action={addProductAction} className="dlgform" success="Product added" reset>
            <div className="dlg-b"><Field label="Name"><input name="name" required /></Field><div className="fgrid c2"><Field label="Price" hint="Blank = quote on request"><input name="price" type="number" min="0" step="any" /></Field><Field label="Stock" hint="Blank = made to order"><input name="stock" type="number" min="0" /></Field></div></div>
            <div className="dlg-f"><button className="btn">Add product</button></div></ActionForm>
        </Modal>
        <Modal title="New order" defaultOpen={sp.add === "1"} trigger={<button className="btn"><Icon n="plus" className="sm" /> New order</button>}>
          <ActionForm action={walkInOrderAction} className="dlgform" success="Order added" reset>
            <div className="dlg-b"><div className="fgrid c2"><Field label="Product"><select name="product">{live.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Quantity"><input name="qty" type="number" min="1" defaultValue="1" /></Field></div>
              <div className="fgrid c2"><Field label="Customer name"><input name="name" /></Field><Field label="Phone"><input name="phone" /></Field></div></div>
            <div className="dlg-f"><button className="btn">Add order</button></div></ActionForm>
        </Modal>
      </PageHeader>
      <Tabs tabs={[{ id: "orders", label: "Orders", badge: orders.filter((o) => o.status === "new").length, content: orderTab }, { id: "catalog", label: "Catalog", content: catalog }]} />
    </>
  );
}
