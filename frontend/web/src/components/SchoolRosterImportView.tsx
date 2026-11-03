import {useEffect,useRef,useState} from 'react';
import { Page,PageHeader } from '@/components/ui/page';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter } from '@/components/ui/dialog';
import { ActionReasonField,permissionDialogClass,validActionReason } from './ActionReasonField.tsx';
import { newActionKey } from '../lib/action-key.ts';
import { previewRoster,confirmRoster,RosterApiError,type RosterPreview } from '../api/identity-client.ts';

const statusLabel={INSERT:'Data baru',UNCHANGED:'Tidak berubah',CORRECTION:'Koreksi',INVALID:'Perlu diperbaiki',REVIEW_REQUIRED:'Perlu ditinjau'};
function message(e:unknown):string {
  const code=e instanceof RosterApiError?e.code:'';
  if(code==='forbidden'||code==='unauthorized')return 'Akses operator tidak tersedia. Periksa akun dan sekolah yang dipilih.';
  if(['stale_conflict','action_key_reused','REVIEW_REQUIRED'].includes(code))return 'Data berubah atau perlu ditinjau. Periksa ulang berkas sebelum mengirim lagi.';
  if(['invalid_request','invalid_csv','payload_too_large'].includes(code))return 'Berkas atau referensi akademik belum sesuai. Periksa templat dan batas berkas.';
  return 'Konfirmasi penyimpanan belum diterima. Anda dapat mengirim ulang tindakan yang sama.';
}
export function SchoolRosterImportView(){
  const [year,setYear]=useState(''),[period,setPeriod]=useState(''),[csv,setCsv]=useState('');
  const [preview,setPreview]=useState<RosterPreview|null>(null),[busy,setBusy]=useState(false),[open,setOpen]=useState(false);
  const [reason,setReason]=useState(''),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const fileRef=useRef<HTMLInputElement>(null),triggerRef=useRef<HTMLButtonElement>(null),retryRef=useRef<HTMLButtonElement>(null);
  const intent=useRef<{key:string;reason:string}|null>(null),completed=useRef(false);
  useEffect(()=>{if(open&&error&&!busy)retryRef.current?.focus();},[open,error,busy]);
  function invalidate(){setPreview(null);setNotice(null);setError(null);intent.current=null;}
  function clear(){invalidate();setCsv('');setOpen(false);if(fileRef.current)fileRef.current.value='';}
  async function check(){
    setBusy(true);setError(null);setNotice(null);intent.current=null;
    try{setPreview(await previewRoster({academicYearId:year,academicPeriodId:period,csv}));}
    catch(e){setPreview(null);setError(message(e));}finally{setBusy(false);}
  }
  async function save(){
    if(!preview||busy||!validActionReason(reason))return;
    intent.current??={key:newActionKey(),reason};setBusy(true);setError(null);
    try{
      const result=await confirmRoster({academicYearId:year,academicPeriodId:period,csv},{inputDigest:preview.inputDigest,stateDigest:preview.stateDigest,requestKey:intent.current.key,reason:intent.current.reason,confirmed:true});
      completed.current=true;clear();setNotice(`Data tersimpan. Baru: ${result.summary.inserted}, koreksi: ${result.summary.corrected}, tidak berubah: ${result.summary.unchanged}.`);
    }catch(e){setError(message(e));}finally{setBusy(false);}
  }
  return <Page id="school-roster" className="min-w-0 [overflow-wrap:anywhere]">
    <PageHeader title="Data Siswa"><p className="m-0 text-muted-foreground">Periksa daftar resmi sekolah sebelum menyimpan. Impor tidak mengaktifkan akun atau memindahkan siswa.</p></PageHeader>
    {notice&&<p role="status" className="m-0 rounded-md border border-border p-4">{notice}</p>}
    {!open&&error&&<p role="alert" className="m-0 text-danger-ink">{error}</p>}
    <Card><CardHeader><CardTitle>Daftar Resmi Sekolah</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted-foreground">Gunakan referensi tahun dan periode dari konfigurasi akademik sekolah. Maksimal 1.000 baris dan 1 MiB per permintaan.</p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div><label htmlFor="roster-year" className="text-sm font-medium">Referensi Tahun Ajaran</label><Input id="roster-year" value={year} disabled={busy} onChange={e=>{invalidate();setYear(e.target.value);}}/></div>
        <div><label htmlFor="roster-period" className="text-sm font-medium">Referensi Periode Akademik</label><Input id="roster-period" value={period} disabled={busy} onChange={e=>{invalidate();setPeriod(e.target.value);}}/></div>
      </div>
      <div><label htmlFor="roster-file" className="text-sm font-medium">Berkas Daftar Siswa CSV</label><Input ref={fileRef} id="roster-file" type="file" accept=".csv,text/csv" disabled={busy} aria-describedby="roster-template" onChange={async e=>{
        invalidate();setCsv('');const file=e.target.files?.[0];if(!file)return;
        if(file.size>1024*1024){setError('Berkas terlalu besar. Maksimal 1 MiB.');return;}
        setBusy(true);try{setCsv(await file.text());}catch{setError('Berkas belum dapat dibaca. Pilih ulang berkas.');}finally{setBusy(false);}
      }}/></div>
      <p id="roster-template" className="m-0 break-all text-sm text-muted-foreground">Kolom templat: source_student_key, full_name, nis, nisn, date_of_birth, academic_group_id. Tanggal menggunakan YYYY-MM-DD. NISN dan tanggal lahir tidak ditampilkan pada pratinjau.</p>
      <div className="flex flex-wrap gap-3"><Button onClick={check} disabled={busy||!csv||!year||!period}>{busy?'Memproses...':'Periksa Berkas'}</Button><Button variant="secondary" onClick={clear} disabled={busy}>Hapus Pilihan</Button></div>
    </CardContent></Card>
    {preview&&<section aria-labelledby="roster-preview-heading" className="flex min-w-0 flex-col gap-3">
      <h2 id="roster-preview-heading" className="m-0 text-lg font-semibold">Hasil Pemeriksaan</h2>
      <p role="status" className="m-0 text-sm">{preview.rows.length} baris diperiksa. {preview.canConfirm?'Siap dikonfirmasi.':'Perbaiki atau tinjau baris yang ditandai. Belum ada data yang disimpan.'}</p>
      <ol className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2">{preview.rows.map(r=><li key={r.line} className="min-w-0 rounded-md border border-border bg-card p-4">
        <p className="m-0 text-sm font-medium">Baris {r.line}: {statusLabel[r.status]}</p><p className="mb-1 mt-2 font-semibold">{r.fullName}</p>
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm"><dt>Kunci sekolah</dt><dd className="m-0 break-all">{r.sourceKey}</dd><dt>NIS</dt><dd className="m-0 break-all">{r.nis}</dd><dt>Rombel</dt><dd className="m-0">{r.groupLabel??'Tidak ditemukan'}</dd></dl>
      </li>)}</ol>
      <Button className="self-start" ref={triggerRef} disabled={busy||!preview.canConfirm} onClick={()=>{completed.current=false;setError(null);setReason('');intent.current=null;setOpen(true);}}>Konfirmasi Impor</Button>
    </section>}
    <Dialog open={open} onOpenChange={next=>{if(!busy)setOpen(next);}}><DialogContent className={`max-h-[90dvh] overflow-y-auto ${permissionDialogClass}`} onCloseAutoFocus={e=>{e.preventDefault();(completed.current?fileRef.current:triggerRef.current)?.focus();}} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onInteractOutside={e=>{if(busy)e.preventDefault();}}>
      <DialogHeader><DialogTitle>Simpan Daftar Siswa?</DialogTitle><DialogDescription>Seluruh berkas disimpan sebagai satu tindakan. Baris yang tidak disertakan tidak dihapus. Tidak ada penggabungan identitas atau perpindahan rombel otomatis.</DialogDescription></DialogHeader>
      <ActionReasonField value={reason} onChange={setReason} disabled={busy||intent.current!==null}/>
      {error&&<p role="alert" className="m-0 text-danger-ink">{error}</p>}
      <DialogFooter><Button variant="secondary" disabled={busy} onClick={()=>setOpen(false)}>Batal</Button><Button ref={retryRef} onClick={save} disabled={busy||!validActionReason(reason)}>{busy?'Menyimpan...':error?'Kirim Ulang Tindakan':'Simpan Daftar'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </Page>;
}
