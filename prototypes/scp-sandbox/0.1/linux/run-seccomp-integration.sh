#!/usr/bin/env sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
for c in gcc ldd unshare mount chroot setpriv prlimit busybox awk; do command -v "$c" >/dev/null 2>&1 || { echo "missing $c" >&2; exit 127; }; done
TMP=$(mktemp /tmp/scp-seccomp-integration.XXXXXX);cleanup(){ rm -rf "$TMP"; };trap cleanup EXIT HUP INT TERM
R="$TMP/rootfs";W="$TMP/work";mkdir -p "$R/bin" "$R/usr/bin" "$R/work" "$W";chmod 0777 "$W"
copy_to(){ src=$1;dst="$R$2";mkdir -p "$(dirname "$dst")";cp -L "$src" "$dst";chmod 0555 "$dst";ldd "$src"|awk '{for(i=1;i<=NF;i++)if($i~/^\//)print $i}'|while read -r lib;do [ -e "$lib" ]||continue;out="$R$lib";mkdir -p "$(dirname "$out")";cp -L "$lib" "$out";chmod 0555 "$out";done; }
gcc -Wall -Wextra -Werror -O2 -DSCP_SECCOMP_TEST_MODE -o "$TMP/seccomp-exec" "$HERE/seccomp-exec.c"
gcc -Wall -Wextra -Werror -O2 -o "$TMP/seccomp-child-test" "$HERE/seccomp-child-test.c"
copy_to "$(command -v busybox)" /bin/busybox;copy_to "$(command -v setpriv)" /usr/bin/setpriv
copy_to "$TMP/seccomp-exec" /usr/bin/seccomp-exec;copy_to "$TMP/seccomp-child-test" /usr/bin/seccomp-child-test
ln -s busybox "$R/bin/sh";printf 'seccomp-fixture-read-ok\n' > "$R/fixture.txt";chmod 0666 "$R/fixture.txt"
chmod 0555 "$R" "$R/bin" "$R/usr" "$R/usr/bin" "$R/work"
HOST_SECRET_CANARY=must-not-enter-client unshare --user --map-users "0:$(id -u):1" --map-users 1:1:65535 --map-groups "0:$(id -g):1" --map-groups 1:1:65535 --mount --net --pid --fork sh -c '
 set -eu;mount --make-rprivate /;mount --bind "$1" "$1";mount -o remount,ro,bind "$1";mount --bind "$2" "$1/work";mount -o remount,rw,bind "$1/work"
 env -i HOME=/tmp PATH=/bin:/usr/bin /usr/bin/prlimit --core=0 --cpu=10 --fsize=1048576 --nofile=64 --nproc=64 --as=268435456 -- /usr/sbin/chroot "$1" /usr/bin/setpriv --reuid=65534 --regid=65534 --clear-groups --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs -- /usr/bin/seccomp-exec --test-mode /usr/bin/seccomp-child-test
' sh "$R" "$W"
