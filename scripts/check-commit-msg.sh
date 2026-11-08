#!/bin/sh
# Checks a commit message's header against the repository's convention:
#   <type>[(<scope>)][!]: <subject>
# Usage: check-commit-msg.sh <message-file>
# The header is the first line that is neither blank nor a git comment.

header=$(grep -v -e '^#' -e '^[[:space:]]*$' "$1" | head -n 1)

case $header in
  'Merge '* | 'Revert "'* | 'fixup! '* | 'squash! '* | 'amend! '*) exit 0 ;;
esac

errors=''
fail() {
  errors="$errors  - $1
"
}

length=$(printf '%s' "$header" | wc -m | tr -d ' ')
if [ "$length" -gt 100 ]; then
  fail "the header is $length characters long; the limit is 100."
fi

if ! printf '%s\n' "$header" | grep -Eq '^[A-Za-z]+(\([^():]*\))?!?:( |$)'; then
  fail 'the header is not in the form <type>[(<scope>)][!]: <subject>.'
else
  prefix=${header%%:*}
  subject=${header#*:}
  subject=${subject# }
  prefix=${prefix%!}
  type=${prefix%%(*}

  case $type in
    build | chore | ci | docs | feat | fix | perf | refactor | revert | style | test) ;;
    *) fail "'$type' is not a known type." ;;
  esac

  case $prefix in
    *'('*)
      scope=${prefix#*(}
      scope=${scope%)}
      if ! printf '%s\n' "$scope" | grep -Eq '^(api|web)(/[a-z0-9]+(-[a-z0-9]+)*)?$'; then
        fail "the scope '$scope' is not api or web, optionally followed by /<topic> in lower-case kebab-case."
      fi
      ;;
  esac

  case $subject in
    *[![:space:]]*) ;;
    *) fail 'the subject is empty.' ;;
  esac

  case $subject in
    [[:upper:]]*) fail 'the subject starts with an upper-case letter.' ;;
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
