import { useState } from "react";
import { OrderList } from "./components/OrderList.js";
import { OrderDetail } from "./components/OrderDetail.js";
import { NewOrderForm } from "./components/NewOrderForm.js";

type View = { name: "list" } | { name: "detail"; orderId: number } | { name: "new" };

export function App() {
  const [view, setView] = useState<View>({ name: "list" });
  const [refreshToken, setRefreshToken] = useState(0);

  function bumpRefresh() {
    setRefreshToken((n) => n + 1);
  }

  return (
    <main>
      <h1>orderdesk</h1>
      <nav>
        <button type="button" onClick={() => setView({ name: "list" })}>
          Orders
        </button>
        <button type="button" onClick={() => setView({ name: "new" })}>
          New order
        </button>
      </nav>

      {view.name === "list" && (
        <OrderList refreshToken={refreshToken} onSelect={(orderId) => setView({ name: "detail", orderId })} />
      )}

      {view.name === "detail" && (
        <OrderDetail
          orderId={view.orderId}
          onChanged={bumpRefresh}
          onClose={() => setView({ name: "list" })}
        />
      )}

      {view.name === "new" && (
        <NewOrderForm
          onCreated={(orderId) => {
            bumpRefresh();
            setView({ name: "detail", orderId });
          }}
        />
      )}
    </main>
  );
}
