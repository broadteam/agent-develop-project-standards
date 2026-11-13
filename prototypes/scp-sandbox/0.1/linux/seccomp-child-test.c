#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <sched.h>
#include <signal.h>
#include <unistd.h>
static int blocked(long n, const char *s) {
 errno = 0;
 long r = syscall(n, 0, 0, 0, 0, 0, 0);
 if (r == -1 && errno == EPERM) { printf("DENIED %s\n", s); return 0; }
 fprintf(stderr, "FAIL %s result=%ld errno=%d\n", s, r, errno);
 return 1;
}
static int check(void) {
 int bad = 0;
 bad += blocked(SYS_getppid, "test-sentinel");
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
#ifdef SYS_ptrace
 bad += blocked(SYS_ptrace, "ptrace");
#endif
#ifdef SYS_pidfd_getfd
 bad += blocked(SYS_pidfd_getfd, "pidfd_getfd");
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
 if (namespace_clone != -1 || errno != EPERM) { fprintf(stderr, "FAIL clone namespace flags result=%ld errno=%d\n", namespace_clone, errno); bad++; }
 else puts("DENIED clone-namespace-flags");
#endif
#ifdef SYS_clone3
 errno = 0;
 long clone3 = syscall(SYS_clone3, NULL, 0);
 if (clone3 != -1 || errno != ENOSYS) { fprintf(stderr, "FAIL clone3 result=%ld errno=%d\n", clone3, errno); bad++; }
 else puts("DENIED clone3-with-libc-fallback");
#endif
#ifdef SYS_bpf
 bad += blocked(SYS_bpf, "bpf");
#endif
#ifdef SYS_userfaultfd
 bad += blocked(SYS_userfaultfd, "userfaultfd");
#endif
 if (getpid() <= 0) { bad++; }
 puts("ALLOWED getpid");
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
