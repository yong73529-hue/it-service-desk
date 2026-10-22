"use client";
import { useActionState, useEffect, useState } from "react";
import { createTicketAction } from "@/app/actions";
import { categories } from "@/lib/constants";
import { FormSubmitButton } from "./FormSubmitButton";
import { CompressedImageInput } from "./CompressedImageInput";
import { SimilarIssueSuggestions } from "./SimilarIssueSuggestions";
type Department = { id: string; name: string };
export function TicketForm({
  departments,
  initial,
  assets,
  quickOptions,
}: {
  departments: Department[];
  initial: { departmentId?: string; phone?: string };
  assets: {id:string;assetNo:string;name:string;brandModel:string|null;location:string}[];
  quickOptions: {type:string;label:string}[];
}) {
  const [state, action] = useActionState(createTicketAction, {});
  const [values, setValues] = useState({
    departmentId: initial.departmentId || departments[0]?.id || "",
    contactPhone: initial.phone || "",
    device: "",
    assetId: "",
    location: "",
    category: "",
    title: "",
    description: "",
    priority: "NORMAL",
    emergencyReason: "",
  });
  useEffect(() => {
    if (state.values) setValues((current) => ({ ...current, ...state.values }));
  }, [state.values]);
  const update = (name: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
  const error = (name: string) => state.fieldErrors?.[name]?.[0];
  const fieldClass = (name: string) =>
    `input ${error(name) ? "border-red-400 bg-red-50/30" : ""}`;
  return (
    <form
      action={action}
      encType="multipart/form-data"
      className="space-y-5"
      noValidate
    >
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <b>暂时无法提交</b>
          <p className="mt-1">{state.error}</p>
          <p className="mt-1 text-xs">
            已填写的文字内容已为你保留；如选择过截图，请重新选择截图。
          </p>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="assetId">关联公司资产（可选）</label>
          <select className={fieldClass("assetId")} id="assetId" name="assetId" value={values.assetId} onChange={(e)=>{const asset=assets.find(item=>item.id===e.target.value);setValues(current=>({...current,assetId:e.target.value,...(asset?{device:[asset.name,asset.brandModel].filter(Boolean).join(" "),location:asset.location}:{})}))}}>
            <option value="">不关联资产，直接填写设备和地点</option>{assets.map(a=><option key={a.id} value={a.id}>{a.assetNo} · {a.name} · {a.location}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">选择资产后会自动带出设备和地点，方便查看该设备过去的维修记录。</p>
        </div>
        <div>
          <label className="label" htmlFor="departmentId">
            部门
          </label>
          <select
            className={fieldClass("departmentId")}
            id="departmentId"
            name="departmentId"
            value={values.departmentId}
            onChange={(e) => update("departmentId", e.target.value)}
            required
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {error("departmentId") && (
            <p className="mt-1 text-xs text-red-600">{error("departmentId")}</p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="contactPhone">
            联系电话
          </label>
          <input
            className={fieldClass("contactPhone")}
            id="contactPhone"
            name="contactPhone"
            type="tel"
            value={values.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
            inputMode="tel"
            minLength={5}
            required
          />
          {error("contactPhone") && (
            <p className="mt-1 text-xs text-red-600">{error("contactPhone")}</p>
          )}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="device">
            故障设备
          </label>
          <input
            className={fieldClass("device")}
            id="device"
            name="device"
            value={values.device}
            list="device-options"
            onChange={(e) => update("device", e.target.value)}
              placeholder="如：Mac Mini"
            minLength={2}
            required
          />
          <datalist id="device-options">{quickOptions.filter(o=>o.type==="DEVICE").map(o=><option key={o.label} value={o.label}/>)}</datalist>
          {error("device") && (
            <p className="mt-1 text-xs text-red-600">{error("device")}</p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="location">
            故障地点
          </label>
          <input
            className={fieldClass("location")}
            id="location"
            name="location"
            value={values.location}
            list="location-options"
            onChange={(e) => update("location", e.target.value)}
              placeholder="如：2616 教室"
            minLength={2}
            required
          />
          <datalist id="location-options">{quickOptions.filter(o=>o.type==="LOCATION").map(o=><option key={o.label} value={o.label}/>)}</datalist>
          {error("location") && (
            <p className="mt-1 text-xs text-red-600">{error("location")}</p>
          )}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="category">
          问题分类
        </label>
        <select
          className={fieldClass("category")}
          id="category"
          name="category"
          value={values.category}
          onChange={(e) => update("category", e.target.value)}
          required
        >
          <option value="">请选择问题类型</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {error("category") && (
          <p className="mt-1 text-xs text-red-600">{error("category")}</p>
        )}
      </div>
      <SimilarIssueSuggestions query={`${values.title} ${values.description} ${values.device}`} />
      <div>
        <label className="label" htmlFor="title">
          问题标题
        </label>
        <input
          className={fieldClass("title")}
          id="title"
          name="title"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          minLength={3}
          maxLength={80}
          placeholder="一句话说明遇到的问题"
          required
        />
        {error("title") && (
          <p className="mt-1 text-xs text-red-600">{error("title")}</p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="description">
          问题描述
        </label>
        <textarea
          className={`${fieldClass("description")} min-h-32 resize-y`}
          id="description"
          name="description"
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          minLength={8}
          maxLength={2000}
          placeholder="请描述故障现象、出现时间，以及已经尝试过的操作"
          required
        />
        {error("description") && (
          <p className="mt-1 text-xs text-red-600">{error("description")}</p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="screenshots">
          故障截图（可选）
        </label>
        <CompressedImageInput id="screenshots" name="screenshots" maxFiles={5} />
        {error("screenshots") && (
          <p className="mt-1 text-xs text-red-600">{error("screenshots")}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          最多 5 张，支持 JPG、PNG、WebP、GIF，单张不超过 5MB。
        </p>
      </div>
      <fieldset>
        <legend className="label">优先级</legend>
        <div className="grid grid-cols-2 gap-3">
          <label
            className={`cursor-pointer rounded-lg border p-4 ${values.priority === "NORMAL" ? "border-[var(--accent)] bg-amber-50" : "border-[var(--line)]"}`}
          >
            <input
              className="mr-2"
              type="radio"
              name="priority"
              value="NORMAL"
              checked={values.priority === "NORMAL"}
              onChange={() => update("priority", "NORMAL")}
            />
            <b className="text-sm">普通</b>
            <span className="mt-1 block pl-5 text-xs text-slate-500">
              按正常队列处理
            </span>
          </label>
          <label
            className={`cursor-pointer rounded-lg border p-4 ${values.priority === "URGENT" ? "border-red-400 bg-red-50" : "border-[var(--line)]"}`}
          >
            <input
              className="mr-2"
              type="radio"
              name="priority"
              value="URGENT"
              checked={values.priority === "URGENT"}
              onChange={() => update("priority", "URGENT")}
            />
            <b className="text-sm text-red-700">紧急</b>
            <span className="mt-1 block pl-5 text-xs text-slate-500">
              业务中断等紧急情况
            </span>
          </label>
        </div>
      </fieldset>
      {values.priority === "URGENT" && (
        <div>
          <label className="label" htmlFor="emergencyReason">
            紧急原因
          </label>
          <textarea
            className={`${fieldClass("emergencyReason")} min-h-24`}
            id="emergencyReason"
            name="emergencyReason"
            value={values.emergencyReason}
            onChange={(e) => update("emergencyReason", e.target.value)}
            minLength={5}
            placeholder="说明影响范围和需要紧急处理的原因"
            required
          />
          {error("emergencyReason") && (
            <p className="mt-1 text-xs text-red-600">
              {error("emergencyReason")}
            </p>
          )}
          <p className="mt-2 text-xs text-red-600">
            运维会核实紧急程度，请勿将普通问题标记为紧急。
          </p>
        </div>
      )}
      <FormSubmitButton className="btn btn-primary w-full">
        提交报修工单
      </FormSubmitButton>
    </form>
  );
}
