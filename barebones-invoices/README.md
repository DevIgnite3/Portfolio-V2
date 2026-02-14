# 💼 Invoice Generator

A lightweight, browser-based tool for generating branded PDF invoices for DevIgnite and its clients. No external dependencies or backend required — just open the app, fill out the form, and download a professional invoice PDF with your company logo and client-specific notes.

---

## 🚀 Features

- Customizable invoice number, client info, and project description
- Auto-calculates total from rate × quantity
- Client-specific note section
- Built-in company payment details
- Styled invoice preview before download
- One-click PDF export (A4 format)
- Works entirely in the browser (no backend required)
- Add your own branding/logo

---

## 🛠️ Getting Started

### 📁 Folder Structure
invoice-generator/
│
├── index.html ← main app UI
├── style.css ← styling for form and invoice
├── script.js ← logic for invoice generation and PDF download
├── logo.png ← your company logo (recommended 300px wide)
└── html2pdf.bundle.min.js ← library for generating PDFs from HTML


### ✅ How to Use

1. Clone or download this repository.
2. Run a local web server (to allow logo rendering):
   - With Python:
     ```bash
     python -m http.server 8000
     ```
     Then open `http://localhost:8000` in your browser.
   - Or use VSCode with the **Live Server** extension. (I found this worked really well)
3. Fill in the invoice form with:
   - Invoice number
   - Date
   - Client name and address
   - Description of services
   - Rate and quantity
   - Custom note (e.g., payment terms)
4. Click **"Generate Invoice"** to preview.
5. Click **"Download PDF"** to save the invoice.

---

## 📌 Customizing

### Company Name
- Replace DevIgnite and any relevant information about our company with your own information in script.js

### 🖼️ Logo
- Replace `logo.png` with your own company logo (preferably PNG format).
- Ensure it’s in the same folder as `index.html`.

### 💬 Notes
- The note field can be used to include payment instructions, thank-you messages, or client-specific terms.
- You can style the note section inside `script.js` if desired.

---

## 🧪 Requirements

- A modern browser (Chrome, Firefox, Edge)
- Local web server (required for PDF logo support due to browser security)

---

## 🙌 Created by

**Nicholas Malan**  
DevIgnite | [devignite.co.za](https://devignite.co.za)  

