#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/syscall.h>
#include <sys/statvfs.h>
#include <sys/vfs.h>
#include <sys/wait.h>
#include <sys/prctl.h>
#include <grp.h>
#include <linux/capability.h>
#include <linux/seccomp.h>
#include <sched.h>
#include <signal.h>
#include <unistd.h>
#ifdef SCP_SECCOMP_TEST_MODE
#define SCP_EXPECTED_DENIAL_ERRNO EACCES
#else
#define SCP_EXPECTED_DENIAL_ERRNO EPERM
#endif
static int blocked(long n, const char *s) {
 errno = 0;
 long r = syscall(n, 0, 0, 0, 0, 0, 0);
 if (r == -1 && errno == SCP_EXPECTED_DENIAL_ERRNO) { printf("DENIED %s\n", s); return 0; }
 fprintf(stderr, "FAIL %s result=%ld errno=%d\n", s, r, errno);
 return 1;
}
static int check_runtime_identity(void) {
 int bad = 0;
 if (getuid() != 65534 || geteuid() != 65534 || getgid() != 65534 || getegid() != 65534) {
  fprintf(stderr, "FAIL uid/gid identity uid=%ld euid=%ld gid=%ld egid=%ld\n", (long)getuid(), (long)geteuid(), (long)getgid(), (long)getegid()); bad++;
 } else { puts("PASS uid-gid-65534"); }
 int groups = getgroups(0, NULL);
 if (groups != 0) { fprintf(stderr, "FAIL supplementary groups count=%d\n", groups); bad++; }
 else { puts("PASS no-supplementary-groups"); }
 if (prctl(PR_GET_NO_NEW_PRIVS, 0, 0, 0, 0) != 1) { fputs("FAIL no_new_privs\n", stderr); bad++; }
 else { puts("PASS no-new-privs"); }
 if (prctl(PR_GET_SECCOMP, 0, 0, 0, 0) != SECCOMP_MODE_FILTER) { fputs("FAIL seccomp mode\n", stderr); bad++; }
 else { puts("PASS seccomp-filter-active"); }
 struct __user_cap_header_struct hdr = { .version = _LINUX_CAPABILITY_VERSION_3, .pid = 0 };
 struct __user_cap_data_struct data[2] = {{0}};
 if (syscall(SYS_capget, &hdr, data) != 0) { perror("capget"); bad++; }
 else if (data[0].effective || data[0].permitted || data[0].inheritable || data[1].effective || data[1].permitted || data[1].inheritable) {
  fputs("FAIL effective/permitted/inheritable capabilities not empty\n", stderr); bad++;
 } else { puts("PASS capability-sets-empty"); }
 for (int cap = 0; cap <= CAP_LAST_CAP; cap++) {
  int state = prctl(PR_CAPBSET_READ, cap, 0, 0, 0);
  if (state != 0) { fprintf(stderr, "FAIL capability bounding set cap=%d state=%d errno=%d\n", cap, state, errno); bad++; break; }
 }
 if (bad == 0) puts("PASS capability-bounding-set-empty");
 return bad;
}
static int check(void) {
 int bad = check_runtime_identity();
#ifdef SCP_SECCOMP_TEST_MODE
 bad += blocked(SYS_getppid, "test-sentinel");
#else
 if (getppid() <= 0) { fputs("FAIL getppid production allow\n", stderr); bad++; }
 else puts("ALLOWED getppid-production");
#endif
#ifdef SYS_mount
 bad += blocked(SYS_mount, "mount");
#endif
#ifdef SYS_umount2
 bad += blocked(SYS_umount2, "umount2");
#endif
#ifdef SYS_open_tree
 bad += blocked(SYS_open_tree, "open_tree");
#endif
#ifdef SYS_move_mount
 bad += blocked(SYS_move_mount, "move_mount");
#endif
#ifdef SYS_fsopen
 bad += blocked(SYS_fsopen, "fsopen");
#endif
#ifdef SYS_fsmount
 bad += blocked(SYS_fsmount, "fsmount");
#endif
#ifdef SYS_mount_setattr
 bad += blocked(SYS_mount_setattr, "mount_setattr");
#endif
#ifdef SYS_fsconfig
 bad += blocked(SYS_fsconfig, "fsconfig");
#endif
#ifdef SYS_fspick
 bad += blocked(SYS_fspick, "fspick");
#endif
#ifdef SYS_pivot_root
 bad += blocked(SYS_pivot_root, "pivot_root");
#endif
#ifdef SYS_chroot
 bad += blocked(SYS_chroot, "chroot");
#endif
#ifdef SYS_ptrace
 bad += blocked(SYS_ptrace, "ptrace");
#endif
#ifdef SYS_pidfd_getfd
 bad += blocked(SYS_pidfd_getfd, "pidfd_getfd");
#endif
#ifdef SYS_pidfd_send_signal
 bad += blocked(SYS_pidfd_send_signal, "pidfd_send_signal");
#endif
#ifdef SYS_kcmp
 errno = 0;
 long compare = syscall(SYS_kcmp, getpid(), getpid(), 0, 0, 0);
 if (compare != -1 || errno != SCP_EXPECTED_DENIAL_ERRNO) { fprintf(stderr, "FAIL kcmp result=%ld errno=%d\n", compare, errno); bad++; }
 else puts("DENIED kcmp");
#endif
#ifdef SYS_process_vm_readv
 bad += blocked(SYS_process_vm_readv, "process_vm_readv");
#endif
#ifdef SYS_process_vm_writev
 bad += blocked(SYS_process_vm_writev, "process_vm_writev");
#endif
#ifdef SYS_process_madvise
 bad += blocked(SYS_process_madvise, "process_madvise");
#endif
#ifdef SYS_unshare
 bad += blocked(SYS_unshare, "unshare");
#endif
#ifdef SYS_clone
 errno = 0;
 long namespace_clone = syscall(SYS_clone, (unsigned long)(CLONE_NEWUSER | SIGCHLD), NULL, NULL, NULL, 0);
 if (namespace_clone != -1 || errno != SCP_EXPECTED_DENIAL_ERRNO) { fprintf(stderr, "FAIL clone namespace flags result=%ld errno=%d\n", namespace_clone, errno); bad++; }
 else puts("DENIED clone-namespace-flags");
#endif
#ifdef SYS_clone3
 errno = 0;
 long clone3 = syscall(SYS_clone3, NULL, 0);
 if (clone3 != -1 || errno != ENOSYS) { fprintf(stderr, "FAIL clone3 result=%ld errno=%d\n", clone3, errno); bad++; }
 else puts("DENIED clone3-with-libc-fallback");
#endif
#if defined(__X32_SYSCALL_BIT) && defined(SYS_getpid)
 pid_t x32_child = fork();
 if (x32_child < 0) { perror("fork x32 probe"); bad++; }
 else if (x32_child == 0) {
  (void)syscall(__X32_SYSCALL_BIT | SYS_getpid);
  _exit(0);
 } else {
  int x32_status = 0;
  if (waitpid(x32_child, &x32_status, 0) != x32_child || !WIFSIGNALED(x32_status) || WTERMSIG(x32_status) != SIGSYS) {
   fprintf(stderr, "FAIL x32 syscall was not killed status=%d\n", x32_status); bad++;
  } else { puts("DENIED x32-abi"); }
 }
#endif
#ifdef SYS_bpf
 bad += blocked(SYS_bpf, "bpf");
#endif
#ifdef SYS_kexec_load
 bad += blocked(SYS_kexec_load, "kexec_load");
#endif
#ifdef SYS_kexec_file_load
 bad += blocked(SYS_kexec_file_load, "kexec_file_load");
#endif
#ifdef SYS_init_module
 bad += blocked(SYS_init_module, "init_module");
#endif
#ifdef SYS_finit_module
 bad += blocked(SYS_finit_module, "finit_module");
#endif
#ifdef SYS_delete_module
 bad += blocked(SYS_delete_module, "delete_module");
#endif
#ifdef SYS_perf_event_open
 bad += blocked(SYS_perf_event_open, "perf_event_open");
#endif
#ifdef SYS_keyctl
 bad += blocked(SYS_keyctl, "keyctl");
#endif
#ifdef SYS_add_key
 bad += blocked(SYS_add_key, "add_key");
#endif
#ifdef SYS_request_key
 bad += blocked(SYS_request_key, "request_key");
#endif
#ifdef SYS_open_by_handle_at
 bad += blocked(SYS_open_by_handle_at, "open_by_handle_at");
#endif
#ifdef SYS_name_to_handle_at
 bad += blocked(SYS_name_to_handle_at, "name_to_handle_at");
#endif
#ifdef SYS_setns
 bad += blocked(SYS_setns, "setns");
#endif
#ifdef SYS_io_uring_setup
 bad += blocked(SYS_io_uring_setup, "io_uring_setup");
#endif
#ifdef SYS_io_uring_enter
 bad += blocked(SYS_io_uring_enter, "io_uring_enter");
#endif
#ifdef SYS_io_uring_register
 bad += blocked(SYS_io_uring_register, "io_uring_register");
#endif
#ifdef SYS_swapon
 bad += blocked(SYS_swapon, "swapon");
#endif
#ifdef SYS_swapoff
 bad += blocked(SYS_swapoff, "swapoff");
#endif
#ifdef SYS_reboot
 bad += blocked(SYS_reboot, "reboot");
#endif
#ifdef SYS_iopl
 bad += blocked(SYS_iopl, "iopl");
#endif
#ifdef SYS_ioperm
 bad += blocked(SYS_ioperm, "ioperm");
#endif
#ifdef SYS_syslog
 bad += blocked(SYS_syslog, "syslog");
#endif
#ifdef SYS_userfaultfd
 bad += blocked(SYS_userfaultfd, "userfaultfd");
#endif
 if (getpid() <= 0) { bad++; }
 puts("ALLOWED getpid");
 errno = 0;
 if (fcntl(9, F_GETFD) != -1 || errno != EBADF) {
  fprintf(stderr, "FAIL inherited host fd 9 is reachable errno=%d\n", errno); bad++;
 } else { puts("DENIED inherited-host-fd"); }
 errno = 0;
 int cwd_canary_fd = open("host-cwd-canary", O_RDONLY | O_CLOEXEC);
 if (cwd_canary_fd >= 0) {
  close(cwd_canary_fd);
  fputs("FAIL inherited host cwd is reachable\n", stderr);
  bad++;
 } else if (errno == ENOENT) {
  puts("DENIED inherited-host-cwd");
 } else {
  fprintf(stderr, "unexpected cwd canary errno=%d\n", errno);
  bad++;
 }
 char b[64] = {0};
 int fd = open("/fixture.txt", O_RDONLY | O_CLOEXEC);
 if (fd < 0 || read(fd, b, sizeof(b)-1) <= 0 || strcmp(b, "seccomp-fixture-read-ok\n")) {
  perror("fixture read"); bad++;
 } else { puts("ALLOWED fixture-read"); }
 if (fd >= 0) close(fd);
 errno = 0;
 fd = open("/fixture.txt", O_WRONLY | O_CLOEXEC);
 if (fd >= 0) { close(fd); fputs("FAIL root writable\n", stderr); bad++; }
 else if (errno == EROFS) { puts("DENIED root-write"); }
 else { fprintf(stderr, "root write errno=%d\n", errno); bad++; }
 struct statfs work_fs;
 if (statfs("/work", &work_fs) != 0 || (unsigned long)work_fs.f_type != 0x01021994UL) {
  fputs("FAIL scratch is not tmpfs\n", stderr); bad++;
 } else { puts("PASS bounded-tmpfs-scratch"); }
 struct statvfs work_vfs;
 if (statvfs("/work", &work_vfs) != 0 || !(work_vfs.f_flag & ST_NOEXEC) ||
     !(work_vfs.f_flag & ST_NOSUID) || !(work_vfs.f_flag & ST_NODEV) || work_vfs.f_files > 4096 ||
     (unsigned long long)work_vfs.f_blocks * work_vfs.f_frsize > 33ULL * 1024ULL * 1024ULL) {
  fputs("FAIL scratch tmpfs mount flags/size\n", stderr); bad++;
 } else { puts("PASS scratch-nosuid-nodev-noexec-32m-4096-inode-limit"); }
 fd = open("/work/seccomp-marker", O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0600);
 if (fd < 0 || write(fd, "ok\n", 3) != 3) { perror("scratch write"); bad++; }
 else { puts("ALLOWED scratch-write"); }
 if (fd >= 0) close(fd);
 return bad ? 1 : 0;
}
int main(int argc, char **argv) {
 if (argc > 1 && !strcmp(argv[1], "--check")) return check();
 if (check()) return 2;
 pid_t p = fork();
 if (p < 0) { perror("fork"); return 3; }
 if (p == 0) {
  execl(argv[0], argv[0], "--check", (char *)NULL);
  perror("exec child"); _exit(4);
 }
 int st = 0;
 if (waitpid(p, &st, 0) != p || !WIFEXITED(st) || WEXITSTATUS(st)) {
  fprintf(stderr, "filter inheritance failed\n"); return 5;
 }
 puts("SECCOMP_FORK_EXEC_INHERITANCE=PASS");
 return 0;
}
