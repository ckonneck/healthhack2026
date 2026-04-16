function getData() {
  return JSON.parse(localStorage.getItem("wiki-data") || "[]");
}