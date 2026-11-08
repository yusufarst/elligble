import { it,expect,vi,beforeEach } from 'vitest';
import { act,render,screen,fireEvent,waitFor } from '@testing-library/react';
import { SchoolRosterImportView } from '../components/SchoolRosterImportView.tsx';
import { availableWorkspaces } from '../session/AppShell.tsx';
import * as client from '../api/identity-client.ts';
vi.mock('../api/identity-client.ts',async()=>({...await vi.importActual<typeof import('../api/identity-client.ts')>('../api/identity-client.ts'),previewRoster:vi.fn(),confirmRoster:vi.fn()}));
beforeEach(()=>vi.resetAllMocks());
const preview:client.RosterPreview={protocolVersion:1,inputDigest:'hash',stateDigest:'state',canConfirm:true,rows:[{line:2,sourceKey:'row',fullName:'Siswa Sintetis',nis:'001',groupLabel:'X-1',status:'INSERT'}]};
const receipt:client.RosterReceipt={id:'receipt',outcome:'APPLIED',summary:{inserted:1,corrected:0,unchanged:0},replayed:false};
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function upload(text='synthetic csv',read?:Promise<string>){const file=new File([text],'students.csv',{type:'text/csv'});Object.defineProperty(file,'text',{value:()=>read??Promise.resolve(text)});fireEvent.change(screen.getByLabelText('Berkas Daftar Siswa CSV'),{target:{files:[file]}});}
function references(){fireEvent.change(screen.getByLabelText('Referensi Tahun Ajaran'),{target:{value:'year'}});fireEvent.change(screen.getByLabelText('Referensi Periode Akademik'),{target:{value:'period'}});}
async function prepare(){vi.mocked(client.previewRoster).mockResolvedValue(preview);references();upload();await waitFor(()=>expect((screen.getByRole('button',{name:'Periksa Berkas'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Periksa Berkas'}));await screen.findByText('Siswa Sintetis');fireEvent.click(screen.getByRole('button',{name:'Konfirmasi Impor'}));await screen.findByRole('dialog',{name:'Simpan Daftar Siswa?'});}
async function expectPurged(){await waitFor(()=>{expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByText('Siswa Sintetis')).toBeNull();expect(screen.queryByRole('button',{name:'Konfirmasi Impor'})).toBeNull();expect((screen.getByRole('button',{name:'Periksa Berkas'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByLabelText('Berkas Daftar Siswa CSV') as HTMLInputElement).value).toBe('');expect(document.activeElement).toBe(screen.getByLabelText('Berkas Daftar Siswa CSV'));});}
it('only server-derived Operator capability adds its workspace',()=>{
  const me={tenantId:'school',tenantDisplayLabel:'School',capabilities:{examParticipant:false,teacher:false,proctor:false}};
  expect(availableWorkspaces(me)).toEqual([]);
  expect(availableWorkspaces({...me,capabilities:{...me.capabilities,schoolOperator:true}})).toEqual(['operator', 'institution']);
});
it('preview must precede confirmation and cancellation creates no write',async()=>{
  vi.mocked(client.previewRoster).mockResolvedValue({protocolVersion:1,inputDigest:'hash',stateDigest:'state',canConfirm:true,rows:[{line:2,sourceKey:'row',fullName:'Siswa Sintetis',nis:'001',groupLabel:'X-1',status:'INSERT'}]});
  render(<SchoolRosterImportView/>);
  expect((screen.getByRole('button',{name:'Periksa Berkas'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Referensi Tahun Ajaran'),{target:{value:'year'}});
  fireEvent.change(screen.getByLabelText('Referensi Periode Akademik'),{target:{value:'period'}});
  const file=new File(['synthetic csv'],'students.csv',{type:'text/csv'});Object.defineProperty(file,'text',{value:async()=>'synthetic csv'});
  fireEvent.change(screen.getByLabelText('Berkas Daftar Siswa CSV'),{target:{files:[file]}});
  await waitFor(()=>expect((screen.getByRole('button',{name:'Periksa Berkas'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Periksa Berkas'}));
  expect(await screen.findByText('Siswa Sintetis')).not.toBeNull();expect(client.confirmRoster).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Konfirmasi Impor'}));expect(await screen.findByRole('dialog',{name:'Simpan Daftar Siswa?'})).not.toBeNull();
  expect((screen.getByRole('button',{name:'Simpan Daftar'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Batal'}));expect(client.confirmRoster).not.toHaveBeenCalled();
  await expectPurged();
  fireEvent.click(screen.getByRole('button',{name:'Hapus Pilihan'}));expect(screen.queryByText('Siswa Sintetis')).toBeNull();
});

it('Escape purges the upload and requires fresh preview with an empty reason',async()=>{
  render(<SchoolRosterImportView/>);await prepare();
  fireEvent.change(screen.getByRole('textbox',{name:'Alasan tindakan'}),{target:{value:'Sensitive synthetic reason'}});
  fireEvent.keyDown(document,{key:'Escape'});await expectPurged();expect(client.confirmRoster).not.toHaveBeenCalled();
  upload('fresh synthetic csv');await waitFor(()=>expect((screen.getByRole('button',{name:'Periksa Berkas'}) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.queryByRole('button',{name:'Konfirmasi Impor'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Periksa Berkas'}));await screen.findByText('Siswa Sintetis');fireEvent.click(screen.getByRole('button',{name:'Konfirmasi Impor'}));
  expect((await screen.findByRole('textbox',{name:'Alasan tindakan'}) as HTMLTextAreaElement).value).toBe('');
  expect((screen.getByRole('button',{name:'Simpan Daftar'}) as HTMLButtonElement).disabled).toBe(true);
  expect(client.previewRoster).toHaveBeenLastCalledWith({academicYearId:'year',academicPeriodId:'period',csv:'fresh synthetic csv'});
});

it('dialog close uses the same purge path as Batal and Escape',async()=>{
  render(<SchoolRosterImportView/>);await prepare();fireEvent.change(screen.getByRole('textbox',{name:'Alasan tindakan'}),{target:{value:'Synthetic canceled reason'}});
  fireEvent.click(screen.getByRole('button',{name:'Tutup'}));await expectPurged();expect(client.confirmRoster).not.toHaveBeenCalled();
});

it.each(['resolve','reject'] as const)('canceling an unfinished file read ignores its late %s',async outcome=>{
  render(<SchoolRosterImportView/>);references();const read=deferred<string>();upload('sensitive synthetic upload',read.promise);
  fireEvent.click(screen.getByRole('button',{name:'Hapus Pilihan'}));await expectPurged();
  await act(async()=>{if(outcome==='resolve')read.resolve('late sensitive synthetic CSV');else read.reject(new Error('Synthetic read failure'));});
  await expectPurged();expect(screen.queryByRole('alert')).toBeNull();expect(client.previewRoster).not.toHaveBeenCalled();expect(client.confirmRoster).not.toHaveBeenCalled();
});

it.each(['resolve','reject'] as const)('canceling an unfinished preview ignores its late %s',async outcome=>{
  render(<SchoolRosterImportView/>);references();const response=deferred<client.RosterPreview>();vi.mocked(client.previewRoster).mockReturnValue(response.promise);upload();
  await waitFor(()=>expect((screen.getByRole('button',{name:'Periksa Berkas'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Periksa Berkas'}));
  fireEvent.click(screen.getByRole('button',{name:'Hapus Pilihan'}));await expectPurged();
  await act(async()=>{if(outcome==='resolve')response.resolve(preview);else response.reject(new client.RosterApiError('unavailable'));});
  await expectPurged();expect(screen.queryByRole('alert')).toBeNull();expect(client.confirmRoster).not.toHaveBeenCalled();
});

it('blocks in-flight dismissal and retries an open uncertain request with the identical key and reason',async()=>{
  const first=deferred<client.RosterReceipt>();vi.mocked(client.confirmRoster).mockReturnValueOnce(first.promise).mockResolvedValueOnce(receipt);
  render(<SchoolRosterImportView/>);await prepare();fireEvent.change(screen.getByRole('textbox',{name:'Alasan tindakan'}),{target:{value:'Synthetic accepted reason'}});fireEvent.click(screen.getByRole('button',{name:'Simpan Daftar'}));
  expect((screen.getByRole('button',{name:'Batal'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Batal'}));fireEvent.keyDown(document,{key:'Escape'});
  expect(screen.getByRole('dialog')).not.toBeNull();expect(client.confirmRoster).toHaveBeenCalledTimes(1);
  await act(async()=>first.reject(new client.RosterApiError('unavailable')));
  const retry=await screen.findByRole('button',{name:'Kirim Ulang Tindakan'});await waitFor(()=>expect(document.activeElement).toBe(retry));
  fireEvent.click(retry);await screen.findByText('Data tersimpan. Baru: 1, koreksi: 0, tidak berubah: 0.');
  expect(client.confirmRoster).toHaveBeenCalledTimes(2);expect(vi.mocked(client.confirmRoster).mock.calls[1]).toEqual(vi.mocked(client.confirmRoster).mock.calls[0]);await expectPurged();
});

it('canceling after failure discards the abandoned intent, reason and error before a fresh operation',async()=>{
  vi.mocked(client.confirmRoster).mockRejectedValueOnce(new client.RosterApiError('unavailable')).mockResolvedValueOnce(receipt);
  render(<SchoolRosterImportView/>);await prepare();fireEvent.change(screen.getByRole('textbox',{name:'Alasan tindakan'}),{target:{value:'Old synthetic reason'}});fireEvent.click(screen.getByRole('button',{name:'Simpan Daftar'}));await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button',{name:'Batal'}));await expectPurged();expect(screen.queryByRole('alert')).toBeNull();
  await prepare();expect((screen.getByRole('textbox',{name:'Alasan tindakan'}) as HTMLTextAreaElement).value).toBe('');
  fireEvent.change(screen.getByRole('textbox',{name:'Alasan tindakan'}),{target:{value:'New synthetic reason'}});fireEvent.click(screen.getByRole('button',{name:'Simpan Daftar'}));await screen.findByText('Data tersimpan. Baru: 1, koreksi: 0, tidak berubah: 0.');
  const calls=vi.mocked(client.confirmRoster).mock.calls;expect(calls[1][1].requestKey).not.toBe(calls[0][1].requestKey);expect(calls[1][1].reason).toBe('New synthetic reason');await expectPurged();
});
