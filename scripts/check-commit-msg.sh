#!/bin/sh
# Checks a commit message's header against the repository's convention:
#   <type>[(<scope>)][!]: <subject>
# Usage: check-commit-msg.sh <message-file>
# The header is the first line that is neither blank nor a git comment,
# above the diff that `git commit -v` adds below its scissors line.

header=$(awk '/^# -+ >8 -+$/ { exit } /^#/ || /^[[:space:]]*$/ { next } { print; exit }' "$1")

case $header in
  'Merge '* | 'Revert "'* | 'fixup! '* | 'squash! '* | 'amend! '*) exit 0 ;;
esac

errors=''
add_error() {
  errors="$errors  - $1
"
}

# Characters, whatever the locale: UTF-8 continuation bytes are not counted.
length=$(printf '%s' "$header" | LC_ALL=C tr -d '\200-\277' | wc -c | tr -d ' ')
if [ "$length" -gt 100 ]; then
  add_error "the header is $length characters long; the limit is 100."
fi

if ! printf '%s\n' "$header" | grep -Eq '^[A-Za-z]+(\([^():]*\))?!?:( |$)'; then
  add_error 'the header is not in the form <type>[(<scope>)][!]: <subject>.'
else
  prefix=${header%%:*}
  subject=${header#*:}
  subject=${subject#"${subject%%[![:space:]]*}"}
  prefix=${prefix%!}
  type=${prefix%%(*}

  case $type in
    build | chore | ci | docs | feat | fix | perf | refactor | revert | style | test) ;;
    *) add_error "'$type' is not a known type." ;;
  esac

  case $prefix in
    *'('*)
      scope=${prefix#*(}
      scope=${scope%)}
      if ! printf '%s\n' "$scope" | grep -Eq '^(api|web)(/[a-z0-9]+(-[a-z0-9]+)*)?$'; then
        add_error "the scope '$scope' is not api or web, optionally followed by /<topic> in lower-case kebab-case."
      fi
      ;;
  esac

  case $subject in
    *[![:space:]]*) ;;
    *) add_error 'the subject is empty.' ;;
  esac

  case $subject in
    [[:upper:]]*) add_error 'the subject starts with an upper-case letter.' ;;
  esac
fi

[ -z "$errors" ] && exit 0

cat >&2 <<EOF
Commit message rejected:
  $header

${errors}
Expected: <type>[(<scope>)][!]: <subject>
  type     build, chore, ci, docs, feat, fix, perf, refactor, revert, style or test
  scope    api or web, optionally followed by /<topic> in lower-case kebab-case;
           left out for a change to the whole repository
  !        optional, marks a breaking change
  subject  not empty, not starting with an upper-case letter
  The whole header is at most 100 characters.

Examples:
  feat(api/news): store each article's publisher
  fix(web): keep the session on refresh
  chore: update the agent skills
EOF
exit 1
