import { strToU8, zipSync } from "fflate"

const xml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
const paragraph = (value: string, bold = false) => `<w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`
const tableCell = (value: unknown, width: number, header = false) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${paragraph(String(value ?? ""), header)}</w:tc>`

export function createDocx(title: string, summary: string[], headers: string[], rows: unknown[][]) {
  // Lebar sel mengikuti jumlah kolom agar tabel tidak melewati batas halaman landscape.
  const cellWidth = Math.max(850, Math.floor(14800 / Math.max(headers.length, 1)))
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${xml(title)}</w:t></w:r></w:p>
    ${summary.map((line) => paragraph(line)).join("")}
    <w:p/>
    <w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>
      <w:tr>${headers.map((header) => tableCell(header, cellWidth, true)).join("")}</w:tr>
      ${rows.map((row) => `<w:tr>${row.map((cell) => tableCell(cell, cellWidth)).join("")}</w:tr>`).join("")}
    </w:tbl>
    <w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
  </w:body></w:document>`
  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="082F63"/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B9C9D8"/><w:left w:val="single" w:sz="4" w:color="B9C9D8"/><w:bottom w:val="single" w:sz="4" w:color="B9C9D8"/><w:right w:val="single" w:sz="4" w:color="B9C9D8"/><w:insideH w:val="single" w:sz="4" w:color="DCE6EF"/><w:insideV w:val="single" w:sz="4" w:color="DCE6EF"/></w:tblBorders></w:tblPr></w:style></w:styles>`),
  }
  return new Blob([zipSync(files, { level: 6 })], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
}
