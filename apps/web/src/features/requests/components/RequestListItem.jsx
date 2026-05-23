/* eslint-disable react/prop-types */
import React from "react";
import RequestStatusBadge from "./RequestStatusBadge";
import { formatDisplayDate } from "../../../shared/utils/date-format.js";
import {
    getItemCountLabel,
    getPrimaryItemImageUrl,
    getPrimaryItemName,
    getRecordDisplayStatus,
    getRecordReason
} from "../utils/purchaseRecordUtils.js";

const RequestListItem = ({ request, onClick }) => {
    const { recordStatus, approvalStatus } = getRecordDisplayStatus(request);
    const reason = getRecordReason(request);
    const imageUrl = getPrimaryItemImageUrl(request);

    return (
        <button
            type="button"
            className="purchase-record-card"
            onClick={() => onClick(request.id)}
        >
            <div className="purchase-record-card__top">
                {imageUrl && <img className="purchase-record-card__thumb" src={imageUrl} alt="" />}
                <div className="purchase-record-card__title-wrap">
                    <h3>{getPrimaryItemName(request)}</h3>
                    <span className="purchase-record-card__meta-chip">{getItemCountLabel(request)}</span>
                </div>
                <RequestStatusBadge recordStatus={recordStatus} approvalStatus={approvalStatus} />
            </div>

            <p className="purchase-record-card__reason">
                {reason ? `${reason.slice(0, 140)}${reason.length > 140 ? "…" : ""}` : "No reason provided"}
            </p>

            <div className="purchase-record-card__footer">
                <span>Submitted {formatDisplayDate(request.createdAt)}</span>
                <span>Updated {formatDisplayDate(request.updatedAt)}</span>
                <span className="purchase-record-card__cta">View details</span>
            </div>
        </button>
    );
};

export default RequestListItem;
