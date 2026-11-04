// Shared Demo Site frontend helpers: cart in localStorage, product loading.
export function getCart() {
  try {
    return JSON.parse(localStorage.getItem("demo-site-cart") ?? "[]");
  } catch {
    return [];
  }
}
export function setCart(items) {
  localStorage.setItem("demo-site-cart", JSON.stringify(items));
  updateCartBadge();
}
export function addToCart(id, qty = 1) {
  const cart = getCart();
  const line = cart.find((l) => l.id === id);
  if (line) line.qty += qty;
  else cart.push({ id, qty });
  setCart(cart);
}
export function cartCount() {
  return getCart().reduce((n, l) => n + l.qty, 0);
}
export function updateCartBadge() {
  const el = document.getElementById("cart-count");
  if (el) el.textContent = String(cartCount());
}
export async function loadProducts() {
  const res = await fetch("/api/products");
  return res.json();
}
updateCartBadge();
