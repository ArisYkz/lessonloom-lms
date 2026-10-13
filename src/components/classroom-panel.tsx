import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import {
  createClassroom,
  getClassroomJoinCode,
  listClassroomMembers,
  listClassrooms,
  removeClassroomMember,
  rotateClassroomJoinCode,
  setClassroomListed,
  setClassroomStatus,
} from "@/lib/teach.functions";
import { classroomErrorKey } from "@/lib/classroom-errors";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ClassroomRow = { id: string; name: string; status: string; listed: boolean };

export function ClassroomPanel({ courseId }: { courseId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchClassrooms = useServerFn(listClassrooms);
  const create = useServerFn(createClassroom);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: classrooms } = useQuery({
    queryKey: ["classrooms", courseId],
    queryFn: () => fetchClassrooms({ data: { courseId } }),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { courseId, name: name.trim() } });
      setName("");
      queryClient.invalidateQueries({ queryKey: ["classrooms", courseId] });
    } catch (err) {
      toast.error(t(classroomErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t("classroom.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("classroom.hint")}</p>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <Input
          placeholder={t("classroom.namePlaceholder")}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          <Plus className="size-4" /> {t("classroom.create")}
        </Button>
      </form>

      {classrooms && classrooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {t("classroom.empty")}
        </p>
      ) : null}

      {(classrooms ?? []).map((c) => (
        <ClassroomCard key={c.id} classroom={c} courseId={courseId} />
      ))}
    </div>
  );
}

export function ClassroomCard({
  classroom,
  courseId,
}: {
  classroom: ClassroomRow;
  courseId: string;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const fetchCode = useServerFn(getClassroomJoinCode);
  const rotate = useServerFn(rotateClassroomJoinCode);
  const setStatus = useServerFn(setClassroomStatus);
  const setListed = useServerFn(setClassroomListed);
  const fetchMembers = useServerFn(listClassroomMembers);
  const removeMember = useServerFn(removeClassroomMember);
  const [busy, setBusy] = useState(false);
  const active = classroom.status === "active";

  const { data: codeData } = useQuery({
    queryKey: ["classroom-code", classroom.id],
    queryFn: () => fetchCode({ data: { classroomId: classroom.id } }),
  });
  const { data: members } = useQuery({
    queryKey: ["classroom-members", classroom.id],
    queryFn: () => fetchMembers({ data: { classroomId: classroom.id } }),
  });

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      queryClient.invalidateQueries({ queryKey: ["classrooms", courseId] });
      queryClient.invalidateQueries({ queryKey: ["my-classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["classroom-code", classroom.id] });
      queryClient.invalidateQueries({ queryKey: ["classroom-members", classroom.id] });
    } catch (err) {
      toast.error(t(classroomErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!codeData) return;
    try {
      await navigator.clipboard.writeText(codeData.code);
      toast.success(t("classroom.copied"));
    } catch {
      toast.error(t("classroom.error"));
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{classroom.name}</span>
        <Badge variant={active ? "secondary" : "outline"}>
          {t(active ? "classroom.active" : "classroom.archived")}
        </Badge>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/teach/classes/$classId" params={{ classId: classroom.id }}>
            {t("classroom.open")} <ArrowRight className="size-4" />
          </Link>
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("classroom.joinCode")}</span>
          <code className="rounded bg-muted px-2 py-1 font-mono text-sm tracking-widest">
            {codeData?.code ?? "—"}
          </code>
          <Button variant="outline" size="sm" disabled={!codeData} onClick={copyCode}>
            <Copy className="size-4" /> {t("classroom.copy")}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Switch
          id={`listed-${classroom.id}`}
          checked={classroom.listed}
          disabled={busy}
          onCheckedChange={(listed) =>
            run(() => setListed({ data: { classroomId: classroom.id, listed } }))
          }
        />
        <div>
          <label htmlFor={`listed-${classroom.id}`} className="text-sm font-medium">
            {t("classroom.listed")}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">{t("classroom.listedHelp")}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => rotate({ data: { classroomId: classroom.id } }))}
          >
            <RefreshCw className="size-4" /> {t("classroom.rotate")}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">{t("classroom.rotateHelp")}</p>
        </div>
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(() =>
                setStatus({
                  data: { classroomId: classroom.id, status: active ? "archived" : "active" },
                }),
              )
            }
          >
            {active ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}{" "}
            {t(active ? "classroom.archive" : "classroom.restore")}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">{t("classroom.archiveHelp")}</p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">{t("classroom.students")}</h3>
        {members && members.length > 0 ? (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 py-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{m.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t("classroom.joined")}: {new Date(m.joined).toLocaleDateString(locale)}
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      aria-label={t("classroom.remove")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("classroom.remove")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("classroom.removeConfirm")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          run(() =>
                            removeMember({
                              data: { classroomId: classroom.id, userId: m.userId },
                            }),
                          )
                        }
                      >
                        {t("classroom.remove")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("classroom.noStudents")}</p>
        )}
      </div>
    </div>
  );
}
