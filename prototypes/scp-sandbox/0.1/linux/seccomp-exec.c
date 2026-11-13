#define _GNU_SOURCE
#include <errno.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <sched.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#define MAX_INSNS 128
static struct sock_filter f[MAX_INSNS]; static unsigned int n;
static void stmt(unsigned short c,unsigned int k){if(n>=MAX_INSNS)exit(90);f[n++]=(struct sock_filter)BPF_STMT(c,k);}
static void jump(unsigned short c,unsigned int k,unsigned char t,unsigned char q){if(n>=MAX_INSNS)exit(90);f[n++]=(struct sock_filter)BPF_JUMP(c,k,t,q);}
static void deny_errno(int x,int e){if(x<0)return;jump(BPF_JMP|BPF_JEQ|BPF_K,(unsigned)x,0,1);stmt(BPF_RET|BPF_K,SECCOMP_RET_ERRNO|((unsigned)e&SECCOMP_RET_DATA));}
static void deny(int x){deny_errno(x,EPERM);}
static int install(void){
 struct sock_fprog p;n=0;
 stmt(BPF_LD|BPF_W|BPF_ABS,(unsigned)offsetof(struct seccomp_data,arch));
 jump(BPF_JMP|BPF_JEQ|BPF_K,AUDIT_ARCH_X86_64,1,0);stmt(BPF_RET|BPF_K,SECCOMP_RET_KILL_PROCESS);
 stmt(BPF_LD|BPF_W|BPF_ABS,(unsigned)offsetof(struct seccomp_data,nr));
#ifdef __NR_clone
 unsigned int nsflags = 0;
#ifdef CLONE_NEWNS
 nsflags |= CLONE_NEWNS;
#endif
#ifdef CLONE_NEWCGROUP
 nsflags |= CLONE_NEWCGROUP;
#endif
#ifdef CLONE_NEWUTS
 nsflags |= CLONE_NEWUTS;
#endif
#ifdef CLONE_NEWIPC
 nsflags |= CLONE_NEWIPC;
#endif
#ifdef CLONE_NEWUSER
 nsflags |= CLONE_NEWUSER;
#endif
#ifdef CLONE_NEWPID
 nsflags |= CLONE_NEWPID;
#endif
#ifdef CLONE_NEWNET
 nsflags |= CLONE_NEWNET;
#endif
#ifdef CLONE_NEWTIME
 nsflags |= CLONE_NEWTIME;
#endif
 if (nsflags) {
  jump(BPF_JMP|BPF_JEQ|BPF_K,__NR_clone,0,3);
  stmt(BPF_LD|BPF_W|BPF_ABS,(unsigned)offsetof(struct seccomp_data,args[0]));
  jump(BPF_JMP|BPF_JSET|BPF_K,nsflags,0,1);
  stmt(BPF_RET|BPF_K,SECCOMP_RET_ERRNO|(EPERM&SECCOMP_RET_DATA));
  stmt(BPF_LD|BPF_W|BPF_ABS,(unsigned)offsetof(struct seccomp_data,nr));
 }
#endif
#ifdef __NR_clone3
 /* ENOSYS lets libc fall back to legacy clone, whose namespace flags are filtered above. */
 deny_errno(__NR_clone3,ENOSYS);
#endif
#ifdef __X32_SYSCALL_BIT
 jump(BPF_JMP|BPF_JSET|BPF_K,__X32_SYSCALL_BIT,0,1);stmt(BPF_RET|BPF_K,SECCOMP_RET_KILL_PROCESS);
#endif
#ifdef __NR_mount
 deny(__NR_mount);
#endif
#ifdef __NR_umount2
 deny(__NR_umount2);
#endif
#ifdef __NR_open_tree
 deny(__NR_open_tree);
#endif
#ifdef __NR_move_mount
 deny(__NR_move_mount);
#endif
#ifdef __NR_fsopen
 deny(__NR_fsopen);
#endif
#ifdef __NR_fsconfig
 deny(__NR_fsconfig);
#endif
#ifdef __NR_fsmount
 deny(__NR_fsmount);
#endif
#ifdef __NR_fspick
 deny(__NR_fspick);
#endif
#ifdef __NR_mount_setattr
 deny(__NR_mount_setattr);
#endif
#ifdef __NR_pivot_root
 deny(__NR_pivot_root);
#endif
#ifdef __NR_chroot
 deny(__NR_chroot);
#endif
#ifdef __NR_ptrace
 deny(__NR_ptrace);
#endif
#ifdef __NR_process_vm_readv
 deny(__NR_process_vm_readv);
#endif
#ifdef __NR_process_vm_writev
 deny(__NR_process_vm_writev);
#endif
#ifdef __NR_pidfd_getfd
 deny(__NR_pidfd_getfd);
#endif
#ifdef __NR_pidfd_send_signal
 deny(__NR_pidfd_send_signal);
#endif
#ifdef __NR_process_madvise
 deny(__NR_process_madvise);
#endif
#ifdef __NR_kcmp
 deny(__NR_kcmp);
#endif
#ifdef __NR_kexec_load
 deny(__NR_kexec_load);
#endif
#ifdef __NR_kexec_file_load
 deny(__NR_kexec_file_load);
#endif
#ifdef __NR_init_module
 deny(__NR_init_module);
#endif
#ifdef __NR_finit_module
 deny(__NR_finit_module);
#endif
#ifdef __NR_delete_module
 deny(__NR_delete_module);
#endif
#ifdef __NR_bpf
 deny(__NR_bpf);
#endif
#ifdef __NR_perf_event_open
 deny(__NR_perf_event_open);
#endif
#ifdef __NR_keyctl
 deny(__NR_keyctl);
#endif
#ifdef __NR_add_key
 deny(__NR_add_key);
#endif
#ifdef __NR_request_key
 deny(__NR_request_key);
#endif
#ifdef __NR_open_by_handle_at
 deny(__NR_open_by_handle_at);
#endif
#ifdef __NR_name_to_handle_at
 deny(__NR_name_to_handle_at);
#endif
#ifdef __NR_setns
 deny(__NR_setns);
#endif
#ifdef __NR_unshare
 deny(__NR_unshare);
#endif
#ifdef __NR_userfaultfd
 deny(__NR_userfaultfd);
#endif
#ifdef __NR_io_uring_setup
 deny(__NR_io_uring_setup);
#endif
#ifdef __NR_io_uring_enter
 deny(__NR_io_uring_enter);
#endif
#ifdef __NR_io_uring_register
 deny(__NR_io_uring_register);
#endif
#ifdef __NR_swapon
 deny(__NR_swapon);
#endif
#ifdef __NR_swapoff
 deny(__NR_swapoff);
#endif
#ifdef __NR_reboot
 deny(__NR_reboot);
#endif
#ifdef __NR_iopl
 deny(__NR_iopl);
#endif
#ifdef __NR_ioperm
 deny(__NR_ioperm);
#endif
#ifdef __NR_syslog
 deny(__NR_syslog);
#endif
#ifdef SCP_SECCOMP_TEST_MODE
#ifdef __NR_getppid
 deny(__NR_getppid);
#endif
#endif
 stmt(BPF_RET|BPF_K,SECCOMP_RET_ALLOW);p.len=(unsigned short)n;p.filter=f;
 if(prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0))return perror("PR_SET_NO_NEW_PRIVS"),-1;
 if(prctl(PR_SET_SECCOMP,SECCOMP_MODE_FILTER,&p))return perror("PR_SET_SECCOMP"),-1;
 return 0;
}
int main(int argc,char **argv){int i=1;
#ifdef SCP_SECCOMP_TEST_MODE
 if(argc>1&&!strcmp(argv[1],"--test-mode"))i=2;
#endif
 if(argc<=i){fprintf(stderr,"usage: %s [--test-mode] command [args...]\n",argv[0]);return 64;}
 if (install()) {
  return 70;
 }
 execvp(argv[i], &argv[i]);
 perror("execvp");
 return 71;
}
