// Page behaviour: reveal on scroll, count-up figures, nav state, copy email.
document.documentElement.classList.add("js");

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("in");
    io.unobserve(e.target);
    e.target.querySelectorAll("[data-count]").forEach(countUp);
    if (e.target.matches("[data-count]")) countUp(e.target);
  }
}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

function countUp(el) {
  if (el.dataset.done) return;
  el.dataset.done = 1;
  const end = +el.dataset.count, suf = el.dataset.suffix || "", t0 = performance.now(), dur = 1400;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - k, 3)));
    el.textContent = v.toLocaleString() + suf;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 40);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

document.querySelectorAll("[data-copy]").forEach((b) => {
  b.addEventListener("click", async () => {
    const small = b.querySelector("small");
    try { await navigator.clipboard.writeText(b.dataset.copy); small.textContent = "copied"; }
    catch { getSelection().selectAllChildren(b.querySelector("span")); small.textContent = "selected"; }
    setTimeout(() => (small.textContent = "copy"), 1800);
  });
});
