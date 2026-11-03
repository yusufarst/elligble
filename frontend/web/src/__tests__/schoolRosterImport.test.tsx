import { it,expect,vi,beforeEach } from 'vitest';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { SchoolRosterImportView } from '../components/SchoolRosterImportView.tsx';
import { availableWorkspaces } from '../session/AppShell.tsx';
import * as client from '../api/identity-client.ts';
vi.mock('../api/identity-client.ts',async()=>({...await vi.importActual<typeof import('../api/identity-client.ts')>('../api/identity-client.ts'),previewRoster:vi.fn(),confirmRoster:vi.fn()}));
beforeEach(()=>vi.clearAllMocks());
it('only server-derived Operator capability adds its workspace',()=>{
  const me={tenantId:'school',tenantDisplayLabel:'School',capabilities:{examParticipant:false,teacher:false,proctor:false}};
  expect(availableWorkspaces(me)).toEqual([]);
  expect(availableWorkspaces({...me,capabilities:{...me.capabilities,schoolOperator:true}})).toEqual(['operator']);
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
  fireEvent.click(screen.getByRole('button',{name:'Hapus Pilihan'}));expect(screen.queryByText('Siswa Sintetis')).toBeNull();
});
