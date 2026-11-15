import React, { useEffect, useState, useRef } from "react";
import { useEscapeToClose } from "./assetUi";
import { createPortal } from "react-dom";
import { X, Download, Printer, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import type { Asset } from "@/lib/api-types";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset?: Asset | null;
  assetTag?: string;
  assetName?: string;
  categoryName?: string;
  brand?: string | null;
  model?: string | null;
}

export function QRCodeModal(props: QRCodeModalProps) {
  useEscapeToClose(props.isOpen, props.onClose);
  const { isOpen, onClose, asset } = props;
  const assetTag = asset?.assetTag ?? props.assetTag ?? "";
  const assetName = asset?.name ?? props.assetName ?? "";
  const categoryName = asset?.category?.name ?? props.categoryName ?? "";
  const brand = asset?.brand ?? props.brand ?? null;
  const model = asset?.model ?? props.model ?? null;
  const [dataUrl, setDataUrl] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && assetTag) {
      // The label opens this item's page in PMT when scanned with a phone camera (it used to hold only the tag)
      const target = asset?.id ? `${window.location.origin}/assets/${asset.id}` : assetTag;
      QRCode.toDataURL(target, {
        width: 320,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff"
        }
      })
        .then((url) => setDataUrl(url))
        .catch((err) => {
          console.error("QR Code generation error:", err);
          toast.error("Failed to generate QR code");
        });
    }
  }, [isOpen, assetTag]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `QR_${assetTag}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("QR code downloaded");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) {
      toast.error("Please allow popups to print the label");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset Label - ${assetTag}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #f8fafc;
            }
            .label-card {
              width: 380px;
              border: 2px solid #0f172a;
              border-radius: 12px;
              padding: 24px;
              text-align: center;
              background: #ffffff;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .company {
              font-size: 14px;
              font-weight: 800;
              letter-spacing: 1.5px;
              color: #4f46e5;
              text-transform: uppercase;
              margin-bottom: 8px;
            }
            .qr-img {
              width: 220px;
              height: 220px;
              margin: 12px auto;
              display: block;
            }
            .tag {
              font-size: 22px;
              font-weight: 800;
              font-family: monospace;
              letter-spacing: 2px;
              color: #0f172a;
              margin-bottom: 6px;
            }
            .name {
              font-size: 16px;
              font-weight: 600;
              color: #334155;
              margin-bottom: 4px;
            }
            .meta {
              font-size: 12px;
              color: #64748b;
            }
            @media print {
              body { background: transparent; height: auto; padding: 20px; }
              .label-card { box-shadow: none; border: 2px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="company">ENTRO LABS IT SOLUTIONS</div>
            <img class="qr-img" src="${dataUrl}" alt="${assetTag}" />
            <div class="tag">${assetTag}</div>
            <div class="name">${assetName}</div>
            <div class="meta">${[categoryName, brand, model].filter(Boolean).join(" • ")}</div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">QR label</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          {/* Label Container */}
          <div
            ref={printRef}
            className="w-full max-w-xs bg-slate-50 dark:bg-slate-800/60 p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center text-center shadow-inner"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">
              Entro Labs IT Solutions
            </span>
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={assetTag}
                className="w-52 h-52 object-contain rounded-xl bg-white p-2 shadow-sm my-2"
              />
            ) : (
              <div className="w-52 h-52 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center animate-pulse my-2">
                <QrCode className="w-12 h-12 text-slate-400" />
              </div>
            )}
            <div className="font-mono text-xl font-bold tracking-wider text-slate-900 dark:text-white mt-1">
              {assetTag}
            </div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate max-w-full">
              {assetName}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {[categoryName, brand, model].filter(Boolean).join(" • ")}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 btn-secondary h-11 flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 btn-primary h-11 flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <Printer className="w-4 h-4" />
            <span>Print label</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

