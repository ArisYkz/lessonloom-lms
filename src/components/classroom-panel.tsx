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
  Link2,
  Pencil,
  Plus,
  QrCode,
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
  renameClassroom,
  rotateClassroomJoinCode,
  setClassroomListed,
  setClassroomOffering,
  setClassroomStatus,
} from "@/lib/teach.functions";
import { classroomErrorKey } from "@/lib/classroom-errors";
import type { Dict } from "@/i18n/dictionary";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { QrCodeImage } from "@/components/qr-code-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

function joinLink(code: string) {
  return `${window.location.origin}/join/${code}`;
}

type ClassroomRow = {
  id: string;
  name: string;
  status: string;
  listed: boolean;
  startDate: string | null;
  endDate: string | null;
  capacity: number | null;
  priceKzt: number | null;
  enrollmentOpen: boolean;
};

function offeringErrorKey(err: unknown): keyof Dict {
  const message = err instanceof Error ? err.message : "";
  if (message === "Invalid dates") return "offering.invalidDates";
  if (message === "Invalid capacity") return "offering.invalidCapacity";
  if (message === "Invalid price") return "offering.invalidPrice";
  if (message === "Capacity below current members") return "offering.capacityBelow";
  return "offering.error";
}

function OfferingForm({ classroom, courseId }: { classroom: ClassroomRow; courseId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(setClassroomOffering);
  const [startDate, setStartDate] = useState(classroom.startDate ?? "");
  const [endDate, setEndDate] = useState(classroom.endDate ?? "");
  const [capacity, setCapacity] = useState(classroom.capacity?.toString() ?? "");
  const [price, setPrice] = useState(classroom.priceKzt?.toString() ?? "");
  const [enrollmentOpen, setEnrollmentOpen] = useState(classroom.enrollmentOpen);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          classroomId: classroom.id,
          startDate: startDate || null,
          endDate: endDate || null,
          capacity: capacity ? Number(capacity) : null,
          priceKzt: price ? Number(price) : null,
          enrollmentOpen,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["classrooms", courseId] });
      toast.success(t("offering.saved"));
    } catch (err) {
      toast.error(t(offeringErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>{t("offering.startDate")}</Label>
        <Input
          type="date"
          className="mt-1"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>
      <div>
        <Label>{t("offering.endDate")}</Label>
        <Input
          type="date"
          className="mt-1"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>
      <div>
        <Label>{t("offering.capacity")}</Label>
        <Input
          type="number"
          min={1}
          max={500}
          className="mt-1"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
      </div>
      <div>
        <Label>{t("offering.price")}</Label>
        <Input
          type="number"
          min={0}
          className="mt-1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <div className="flex items-start gap-3 sm:col-span-2">
        <Switch
          id={`enroll-${classroom.id}`}
          checked={enrollmentOpen}
          onCheckedChange={setEnrollmentOpen}
        />
        <div>
          <label htmlFor={`enroll-${classroom.id}`} className="text-sm font-medium">
            {t("offering.enrollmentOpen")}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">{t("offering.enrollmentOpenHelp")}</p>
        </div>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy}>
          {t("offering.save")}
        </Button>
      </div>
    </form>
  );
}

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
      queryClient.invalidateQueries({ queryKey: ["my-classrooms"] });
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

function RenameClassroomDialog({
  classroom,
  courseId,
}: {
  classroom: ClassroomRow;
  courseId: string;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const rename = useServerFn(renameClassroom);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(classroom.name);
  const [busy, setBusy] = useState(false);
  const clean = name.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await rename({ data: { classroomId: classroom.id, name: clean } });
      toast.success(t("classroom.renamed"));
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["classrooms", courseId] });
      queryClient.invalidateQueries({ queryKey: ["my-classrooms"] });
    } catch (err) {
      toast.error(t(classroomErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setName(classroom.name);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={busy}>
          <Pencil className="size-4" /> {t("classroom.rename")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("classroom.renameTitle")}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>{t("classroom.nameLabel")}</Label>
            <Input
              className="mt-1"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy || !clean || clean === classroom.name}>
            {t("classroom.rename")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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

  async function run(action: () => Promise<unknown>, successKey?: keyof Dict) {
    setBusy(true);
    try {
      await action();
      if (successKey) toast.success(t(successKey));
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

  async function copyLink() {
    if (!codeData) return;
    try {
      await navigator.clipboard.writeText(joinLink(codeData.code));
      toast.success(t("classroom.linkCopied"));
    } catch {
      toast.error(t("classroom.error"));
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{classroom.name}</span>
        <RenameClassroomDialog classroom={classroom} courseId={courseId} />
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
          <Button variant="outline" size="sm" disabled={!codeData} onClick={copyLink}>
            <Link2 className="size-4" /> {t("classroom.copyLink")}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!codeData}>
                <QrCode className="size-4" /> {t("classroom.showQr")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("classroom.qrTitle")}</DialogTitle>
                <DialogDescription>{t("classroom.qrHelp")}</DialogDescription>
              </DialogHeader>
              {codeData ? (
                <div className="flex justify-center">
                  <QrCodeImage value={joinLink(codeData.code)} />
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
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

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t("offering.title")}</h3>
        <OfferingForm classroom={classroom} courseId={courseId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <RefreshCw className="size-4" /> {t("classroom.rotate")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("classroom.rotate")}</AlertDialogTitle>
                <AlertDialogDescription>{t("classroom.rotateConfirm")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    run(
                      () => rotate({ data: { classroomId: classroom.id } }),
                      "classroom.codeRotated",
                    )
                  }
                >
                  {t("classroom.rotate")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="mt-2 text-xs text-muted-foreground">{t("classroom.rotateHelp")}</p>
        </div>
        <div>
          {active ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy}>
                  <Archive className="size-4" /> {t("classroom.archive")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("classroom.archive")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("classroom.archiveConfirm")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      run(
                        () =>
                          setStatus({ data: { classroomId: classroom.id, status: "archived" } }),
                        "classroom.archiveDone",
                      )
                    }
                  >
                    {t("classroom.archive")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => setStatus({ data: { classroomId: classroom.id, status: "active" } }),
                  "classroom.restoreDone",
                )
              }
            >
              <ArchiveRestore className="size-4" /> {t("classroom.restore")}
            </Button>
          )}
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
