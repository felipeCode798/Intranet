import { FileText, ImagePlus, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { errorMessage, fileUrl, uploadFiles } from '../lib/api';
import { fileSize } from '../lib/format';
import type { FileValue } from '../lib/types';
import { Spinner, useToast } from './ui';

/** Carga de adjuntos (varios archivos) */
export function FileUpload({ value, onChange, disabled }: { value: FileValue[]; onChange: (v: FileValue[]) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const toast = useToast();

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const up = await uploadFiles([...files]);
      onChange([...value, ...up]);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div>
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onClick={() => !disabled && ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
      >
        <div className="ico-box sm">{busy ? <Spinner /> : <UploadCloud />}</div>
        <div>
          <b>Arrastra archivos o haz clic para adjuntar</b>
          <div className="xs faint">PDF, Word, Excel, imágenes · máx. 20 MB por archivo</div>
        </div>
        <input ref={ref} type="file" multiple hidden onChange={(e) => add(e.target.files)} />
      </div>
      {value.length > 0 && (
        <div className="file-list">
          {value.map((f, i) => (
            <div className="file-item" key={f.url + i}>
              <FileText />
              <a className="name" href={fileUrl(f.url)} target="_blank" rel="noreferrer">
                {f.fileName}
              </a>
              <span className="xs faint">{fileSize(f.size)}</span>
              <button type="button" className="icon-btn sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Quitar">
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AttachmentList({ files }: { files: FileValue[] }) {
  if (!files.length) return null;
  return (
    <div className="file-list">
      {files.map((f, i) => (
        <a className="file-item" key={f.url + i} href={fileUrl(f.url)} target="_blank" rel="noreferrer">
          <Paperclip />
          <span className="name">{f.fileName}</span>
          <span className="xs faint">{fileSize(f.size)}</span>
        </a>
      ))}
    </div>
  );
}

/** Espacio para una imagen (logo, portada, misión…) */
export function ImageSlot({
  value,
  onChange,
  label,
  hint,
  height = 150,
  contain,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  label: string;
  hint?: string;
  height?: number;
  contain?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const pick = async (files: FileList | null) => {
    if (!files?.[0]) return;
    if (!files[0].type.startsWith('image/')) return toast('Selecciona una imagen', 'error');
    setBusy(true);
    try {
      const [up] = await uploadFiles([files[0]]);
      onChange(up.url);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="field">
      <label>{label}</label>
      <div className={`img-slot ${contain ? 'contain' : ''}`} style={{ minHeight: height }} onClick={() => ref.current?.click()} role="button" tabIndex={0}>
        {value ? (
          <>
            <img src={fileUrl(value)} alt={label} />
            <button
              type="button"
              className="icon-btn sm rm"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              aria-label="Quitar imagen"
            >
              <Trash2 />
            </button>
          </>
        ) : (
          <div className="ph">
            {busy ? <Spinner /> : <ImagePlus />}
            <div>{busy ? 'Subiendo…' : 'Haz clic para subir una imagen'}</div>
            {hint && <div className="xs">{hint}</div>}
          </div>
        )}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files)} />
      </div>
    </div>
  );
}
