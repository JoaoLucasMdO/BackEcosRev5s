// normalizeCpf(value)
// Remove qualquer caractere não numérico e retorna string com 11 dígitos ou null
export default function normalizeCpf(value) {
  if (value === undefined || value === null) return null;
  const s = value.toString().replace(/\D/g, "");
  return s === "" ? null : s;
}
